const scriptedModel = { reply: '' };

export const resetModelReply = () => {
  scriptedModel.reply = '';
};

export const setModelReply = (reply: string) => {
  scriptedModel.reply = reply;
};

export const streamScriptedReply = () => {
  const reply = scriptedModel.reply;
  return {
    finalStep: Promise.resolve({ response: { messages: [{ content: reply, role: 'assistant' }] } }),
    finishReason: Promise.resolve('stop'),
    stream: (function* () {
      yield { text: reply, type: 'text-delta' };
    })(),
    toolCalls: Promise.resolve([]),
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
  };
};
