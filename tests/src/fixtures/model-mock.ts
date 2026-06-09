import * as realAiCore from '@totvibe/core/ai-core';
import { mock } from 'bun:test';

const realExports = { ...realAiCore };

let scriptedReply = '';

export const resetModelReply = () => {
  scriptedReply = '';
};

export const setModelReply = (reply: string) => {
  scriptedReply = reply;
};

const streamText = () => {
  const reply = scriptedReply;
  return {
    finishReason: Promise.resolve('stop'),
    fullStream: (function* () {
      yield { text: reply, type: 'text-delta' };
    })(),
    response: Promise.resolve({ messages: [{ content: reply, role: 'assistant' }] }),
    toolCalls: Promise.resolve([]),
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
  };
};

void mock.module('@totvibe/core/ai-core', () => ({ ...realExports, streamText }));
