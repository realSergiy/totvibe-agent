import { mock } from "bun:test";
import * as realAiCore from "@totvibe/core/ai-core";

const realExports = { ...realAiCore };

let scriptedReply = "";

export function setModelReply(reply: string): void {
  scriptedReply = reply;
}

export function resetModelReply(): void {
  scriptedReply = "";
}

function streamText() {
  const reply = scriptedReply;
  return {
    fullStream: (function* () {
      yield { type: "text-delta", text: reply };
    })(),
    response: Promise.resolve({ messages: [{ role: "assistant", content: reply }] }),
    finishReason: Promise.resolve("stop"),
    usage: Promise.resolve({ totalTokens: 0, inputTokens: 0, outputTokens: 0 }),
    toolCalls: Promise.resolve([]),
  };
}

void mock.module("@totvibe/core/ai-core", () => ({ ...realExports, streamText }));
