import {
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ToolResultPart,
  type ToolSet,
} from "./ai-core";
import type { AgentEvent } from "./events";
import type { Session } from "./session";
import { passthrough, type Middleware } from "./pipeline";
import {
  buildModelToolSet,
  runToolCalls,
  type AnyToolDef,
  type ToolCallOutcome,
  type ToolCallRequest,
  type ToolContext,
} from "./tool";

export interface AgentDeps {
  model: LanguageModel;
  fallbackModel?: LanguageModel;
  system: string;
  tools: AnyToolDef[];
  middleware?: Middleware;
  cwd: string;
  maxSteps?: number;
  wallClockMs?: number;
  tokenBudget?: number;
  signal?: AbortSignal;
}

const DEFAULT_MAX_STEPS = 24;

export async function* runAgent(
  session: Session,
  userText: string,
  deps: AgentDeps,
): AsyncGenerator<AgentEvent> {
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const middleware = deps.middleware ?? passthrough;
  const modelTools = buildModelToolSet(deps.tools);
  const toolContext: ToolContext = { cwd: deps.cwd, signal: deps.signal };
  const deadline = deps.wallClockMs ? Date.now() + deps.wallClockMs : undefined;

  const userMessage: ModelMessage = { role: "user", content: userText };
  session.messages.push(userMessage);
  yield { type: "message", message: userMessage };
  yield { type: "turn_start" };

  let usedTokens = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    if (deps.signal?.aborted) {
      yield { type: "aborted" };
      return;
    }
    if (deadline !== undefined && Date.now() > deadline) {
      yield { type: "turn_end", finishReason: "wall_clock" };
      return;
    }
    if (deps.tokenBudget !== undefined && usedTokens >= deps.tokenBudget) {
      yield { type: "turn_end", finishReason: "token_budget" };
      return;
    }

    let turn: TurnResult;
    try {
      turn = yield* streamModelTurn(
        deps.model,
        deps,
        session.messages,
        modelTools,
      );
    } catch (error) {
      if (!deps.fallbackModel) {
        yield { type: "error", error: describeError(error) };
        return;
      }
      try {
        turn = yield* streamModelTurn(
          deps.fallbackModel,
          deps,
          session.messages,
          modelTools,
        );
      } catch (fallbackError) {
        yield { type: "error", error: describeError(fallbackError) };
        return;
      }
    }

    if (turn.aborted) {
      yield { type: "aborted" };
      return;
    }

    for (const message of turn.messages) {
      session.messages.push(message);
      yield { type: "message", message };
    }
    usedTokens += turn.tokens;

    if (turn.calls.length === 0) {
      yield { type: "turn_end", finishReason: turn.finishReason };
      return;
    }

    const outcomes = await runToolCalls(
      deps.tools,
      turn.calls,
      toolContext,
      middleware,
    );
    const toolMessage = buildToolMessage(outcomes);
    session.messages.push(toolMessage);
    for (const outcome of outcomes) {
      if (outcome.isError) {
        yield {
          type: "tool_error",
          id: outcome.toolCallId,
          name: outcome.toolName,
          error: outcome.text,
        };
      } else {
        yield {
          type: "tool_result",
          id: outcome.toolCallId,
          name: outcome.toolName,
          output: outcome.text,
        };
      }
    }
    yield { type: "message", message: toolMessage };
  }

  yield { type: "turn_end", finishReason: "max_steps" };
}

interface TurnResult {
  messages: ModelMessage[];
  finishReason: string;
  calls: ToolCallRequest[];
  tokens: number;
  aborted: boolean;
}

async function* streamModelTurn(
  model: LanguageModel,
  deps: AgentDeps,
  messages: ModelMessage[],
  modelTools: ToolSet,
): AsyncGenerator<AgentEvent, TurnResult> {
  const stream = streamText({
    model,
    system: deps.system,
    messages,
    tools: modelTools,
    abortSignal: deps.signal,
    onError: () => {},
  });

  for await (const part of stream.fullStream) {
    switch (part.type) {
      case "text-delta":
        yield { type: "text", text: part.text };
        break;
      case "reasoning-delta":
        yield { type: "reasoning", text: part.text };
        break;
      case "tool-call":
        yield {
          type: "tool_call",
          id: part.toolCallId,
          name: part.toolName,
          input: part.input,
        };
        break;
      case "error":
        throw toError(part.error);
      case "abort":
        return {
          messages: [],
          finishReason: "aborted",
          calls: [],
          tokens: 0,
          aborted: true,
        };
    }
  }

  const response = await stream.response;
  const finishReason = await stream.finishReason;
  const usage = await stream.usage;
  const toolCalls = await stream.toolCalls;
  const calls: ToolCallRequest[] = toolCalls.map((call) => ({
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    input: call.input,
  }));
  return {
    messages: response.messages,
    finishReason,
    calls,
    tokens:
      usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    aborted: false,
  };
}

function buildToolMessage(outcomes: ToolCallOutcome[]): ModelMessage {
  const content: ToolResultPart[] = outcomes.map((outcome) => ({
    type: "tool-result",
    toolCallId: outcome.toolCallId,
    toolName: outcome.toolName,
    output: outcome.isError
      ? { type: "error-text", value: outcome.text }
      : { type: "text", value: outcome.text },
  }));
  return { role: "tool", content };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

