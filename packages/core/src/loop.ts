import type { AgentEvent } from './events';
import type { Session } from './session';

import { type LanguageModel, type ModelMessage, streamText, type ToolResultPart, type ToolSet } from './ai-core';
import { type Middleware, passthrough } from './pipeline';
import {
  type AnyToolDef,
  buildModelToolSet,
  runToolCalls,
  type ToolCallOutcome,
  type ToolCallRequest,
  type ToolContext,
} from './tool';

export type AgentDeps = {
  cwd: string;
  fallbackModel?: LanguageModel;
  maxSteps?: number;
  middleware?: Middleware;
  model: LanguageModel;
  signal?: AbortSignal;
  system: string;
  tokenBudget?: number;
  tools: AnyToolDef[];
  wallClockMs?: number;
};

const DEFAULT_MAX_STEPS = 24;

type TurnResult = {
  aborted: boolean;
  calls: ToolCallRequest[];
  finishReason: string;
  messages: ModelMessage[];
  tokens: number;
};

export async function* runAgent(session: Session, userText: string, deps: AgentDeps) {
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const middleware = deps.middleware ?? passthrough;
  const modelTools = buildModelToolSet(deps.tools);
  const toolContext: ToolContext = { cwd: deps.cwd, signal: deps.signal };
  const deadline = deps.wallClockMs ? Date.now() + deps.wallClockMs : undefined;

  const userMessage: ModelMessage = { content: userText, role: 'user' };
  session.messages.push(userMessage);
  yield { message: userMessage, type: 'message' } satisfies AgentEvent;
  yield { type: 'turn_start' } satisfies AgentEvent;

  let usedTokens = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    if (deps.signal?.aborted) {
      yield { type: 'aborted' } satisfies AgentEvent;
      return;
    }
    if (deadline !== undefined && Date.now() > deadline) {
      yield { finishReason: 'wall_clock', type: 'turn_end' } satisfies AgentEvent;
      return;
    }
    if (deps.tokenBudget !== undefined && usedTokens >= deps.tokenBudget) {
      yield { finishReason: 'token_budget', type: 'turn_end' } satisfies AgentEvent;
      return;
    }

    let turn: TurnResult;
    try {
      turn = yield* streamModelTurn(deps.model, deps, session.messages, modelTools);
    } catch (error) {
      if (!deps.fallbackModel) {
        yield { error: describeError(error), type: 'error' } satisfies AgentEvent;
        return;
      }
      try {
        turn = yield* streamModelTurn(deps.fallbackModel, deps, session.messages, modelTools);
      } catch (fallbackError) {
        yield { error: describeError(fallbackError), type: 'error' } satisfies AgentEvent;
        return;
      }
    }

    if (turn.aborted) {
      yield { type: 'aborted' } satisfies AgentEvent;
      return;
    }

    for (const message of turn.messages) {
      session.messages.push(message);
      yield { message, type: 'message' } satisfies AgentEvent;
    }
    usedTokens += turn.tokens;

    if (turn.calls.length === 0) {
      yield { finishReason: turn.finishReason, type: 'turn_end' } satisfies AgentEvent;
      return;
    }

    const outcomes = await runToolCalls(deps.tools, turn.calls, toolContext, middleware);
    const toolMessage = buildToolMessage(outcomes);
    session.messages.push(toolMessage);
    for (const outcome of outcomes) {
      yield (
        outcome.isError
          ? {
              error: outcome.text,
              id: outcome.toolCallId,
              name: outcome.toolName,
              type: 'tool_error',
            }
          : {
              id: outcome.toolCallId,
              name: outcome.toolName,
              output: outcome.text,
              type: 'tool_result',
            }
      ) satisfies AgentEvent;
    }
    yield { message: toolMessage, type: 'message' } satisfies AgentEvent;
  }

  yield { finishReason: 'max_steps', type: 'turn_end' } satisfies AgentEvent;
}

const buildToolMessage = (outcomes: ToolCallOutcome[]) => {
  const content: ToolResultPart[] = outcomes.map(outcome => ({
    output: outcome.isError ? { type: 'error-text', value: outcome.text } : { type: 'text', value: outcome.text },
    toolCallId: outcome.toolCallId,
    toolName: outcome.toolName,
    type: 'tool-result',
  }));
  const message: ModelMessage = { content, role: 'tool' };
  return message;
};

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function* streamModelTurn(model: LanguageModel, deps: AgentDeps, messages: ModelMessage[], modelTools: ToolSet) {
  const stream = streamText({
    abortSignal: deps.signal,
    messages,
    model,
    onError: () => void 0,
    system: deps.system,
    tools: modelTools,
  });

  for await (const part of stream.fullStream) {
    switch (part.type) {
      case 'error': {
        throw toError(part.error);
      }
      case 'abort': {
        return {
          aborted: true,
          calls: [],
          finishReason: 'aborted',
          messages: [],
          tokens: 0,
        };
      }
      case 'reasoning-delta': {
        yield { text: part.text, type: 'reasoning' } satisfies AgentEvent;
        break;
      }
      case 'text-delta': {
        yield { text: part.text, type: 'text' } satisfies AgentEvent;
        break;
      }
      case 'tool-call': {
        const input: unknown = part.input;
        yield {
          id: part.toolCallId,
          input,
          name: part.toolName,
          type: 'tool_call',
        } satisfies AgentEvent;
        break;
      }
    }
  }

  const response = await stream.response;
  const finishReason = await stream.finishReason;
  const usage = await stream.usage;
  const toolCalls = await stream.toolCalls;
  const calls: ToolCallRequest[] = toolCalls.map(call => {
    const input: unknown = call.input;
    return { input, toolCallId: call.toolCallId, toolName: call.toolName };
  });
  return {
    aborted: false,
    calls,
    finishReason,
    messages: response.messages,
    tokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  };
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));
