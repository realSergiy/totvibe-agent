import type { ModelMessage } from 'ai';

export type ScriptedTurn = {
  finishReason: string;
  messages: ModelMessage[];
  parts: StreamPart[];
  toolCalls: ScriptedToolCall[];
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

type ScriptedToolCall = {
  input: unknown;
  toolCallId: string;
  toolName: string;
};

type StreamPart =
  | { error: unknown; type: 'error' }
  | { input: unknown; toolCallId: string; toolName: string; type: 'tool-call' }
  | { text: string; type: 'reasoning-delta' }
  | { text: string; type: 'text-delta' }
  | { type: 'abort' };

const turnQueue: ScriptedTurn[] = [];

export const textTurn = (reply: string, overrides: Partial<ScriptedTurn> = {}): ScriptedTurn => ({
  finishReason: 'stop',
  messages: [{ content: reply, role: 'assistant' }],
  parts: [{ text: reply, type: 'text-delta' }],
  toolCalls: [],
  usage: {},
  ...overrides,
});

export const toolCallTurn = (calls: ScriptedToolCall[], overrides: Partial<ScriptedTurn> = {}): ScriptedTurn =>
  textTurn('', {
    finishReason: 'tool-calls',
    messages: [],
    parts: calls.map(call => ({ ...call, type: 'tool-call' })),
    toolCalls: calls,
    ...overrides,
  });

export const failingTurn = (error: unknown): ScriptedTurn => textTurn('', { parts: [{ error, type: 'error' }] });

export const abortedTurn = (): ScriptedTurn => textTurn('', { parts: [{ type: 'abort' }] });

export const scriptModelTurns = (...turns: ScriptedTurn[]) => {
  turnQueue.length = 0;
  turnQueue.push(...turns);
};

export const resetModelReply = () => {
  scriptModelTurns();
};

export const setModelReply = (reply: string) => {
  scriptModelTurns(textTurn(reply));
};

export const streamScriptedReply = () => {
  const turn = turnQueue.shift() ?? textTurn('');
  return {
    finalStep: Promise.resolve({ response: { messages: turn.messages } }),
    finishReason: Promise.resolve(turn.finishReason),
    stream: (function* () {
      yield* turn.parts;
    })(),
    toolCalls: Promise.resolve(turn.toolCalls),
    usage: Promise.resolve(turn.usage),
  };
};
