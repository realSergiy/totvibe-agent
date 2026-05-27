import { streamText, stepCountIs, type LanguageModel, type ToolSet } from "ai";
import type { AgentEvent } from "./events";
import type { Session } from "./session";

export interface AgentDeps {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  maxSteps?: number;
  signal?: AbortSignal;
}

export async function* runAgent(
  session: Session,
  userText: string,
  deps: AgentDeps,
): AsyncGenerator<AgentEvent> {
  session.messages.push({ role: "user", content: userText });
  yield { type: "turn_start" };

  const stream = streamText({
    model: deps.model,
    system: deps.system,
    messages: session.messages,
    tools: deps.tools,
    stopWhen: stepCountIs(deps.maxSteps ?? 24),
    abortSignal: deps.signal,
  });

  try {
    for await (const part of stream.fullStream) {
      switch (part.type) {
        case "text-delta":
          yield { type: "text", text: part.text };
          break;
        case "reasoning-delta":
          yield { type: "reasoning", text: part.text };
          break;
        case "tool-call":
          yield { type: "tool_call", id: part.toolCallId, name: part.toolName, input: part.input };
          break;
        case "tool-result":
          yield { type: "tool_result", id: part.toolCallId, name: part.toolName, output: part.output };
          break;
        case "tool-error":
          yield { type: "tool_error", id: part.toolCallId, name: part.toolName, error: describeError(part.error) };
          break;
        case "error":
          yield { type: "error", error: describeError(part.error) };
          break;
        case "abort":
          yield { type: "aborted" };
          return;
      }
    }

    const response = await stream.response;
    session.messages.push(...response.messages);
    yield { type: "turn_end", finishReason: await stream.finishReason };
  } catch (error) {
    yield { type: "error", error: describeError(error) };
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
