import { test, expect } from "bun:test";
import { convertArrayToReadableStream, MockLanguageModelV3 } from "ai/test";
import { z } from "zod";
import type { AgentEvent } from "./events";
import { runAgent } from "./loop";
import { createSession } from "./session";
import { defineTool } from "./tool";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function stopStream(text: string) {
  return convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    { type: "finish", finishReason: "stop", usage },
  ] as never[]);
}

function toolCallStream(toolName: string, input: unknown) {
  return convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: "c1", toolName, input: JSON.stringify(input) },
    { type: "finish", finishReason: "tool-calls", usage },
  ] as never[]);
}

function errorStream() {
  return convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { type: "error", error: new Error("model boom") },
    { type: "finish", finishReason: "error", usage },
  ] as never[]);
}

const echo = defineTool({
  name: "echo",
  description: "echo the value",
  risk: "read",
  inputSchema: z.object({ value: z.string() }),
  execute: async ({ value }) => `echo:${value}`,
});

async function collect(generator: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

test("loop terminates when the model stops without tool calls", async () => {
  const model = new MockLanguageModelV3({ doStream: async () => ({ stream: stopStream("hi") }) });
  const session = createSession("s");
  const events = await collect(runAgent(session, "hello", { model, system: "sys", tools: [echo], cwd: "/tmp" }));

  expect(events[0]).toEqual({ type: "message", message: { role: "user", content: "hello" } });
  expect(events.some((event) => event.type === "turn_start")).toBe(true);
  expect(events.at(-1)?.type).toBe("turn_end");
  expect(session.messages[0]).toEqual({ role: "user", content: "hello" });
});

test("loop runs a tool call, feeds the result back, then completes", async () => {
  let call = 0;
  const model = new MockLanguageModelV3({
    doStream: async () => {
      call += 1;
      return { stream: call === 1 ? toolCallStream("echo", { value: "x" }) : stopStream("done") };
    },
  });
  const session = createSession("s");
  const events = await collect(runAgent(session, "go", { model, system: "sys", tools: [echo], cwd: "/tmp" }));

  const result = events.find((event) => event.type === "tool_result");
  expect(result).toMatchObject({ name: "echo", output: "echo:x" });
  expect(events.at(-1)?.type).toBe("turn_end");
  expect(session.messages.some((message) => message.role === "tool")).toBe(true);
});

test("loop honors the step cap", async () => {
  const model = new MockLanguageModelV3({
    doStream: async () => ({ stream: toolCallStream("echo", { value: "x" }) }),
  });
  const session = createSession("s");
  const events = await collect(
    runAgent(session, "go", { model, system: "sys", tools: [echo], cwd: "/tmp", maxSteps: 2 }),
  );

  expect(events.at(-1)).toMatchObject({ type: "turn_end", finishReason: "max_steps" });
  expect(events.filter((event) => event.type === "tool_call").length).toBe(2);
});

test("loop falls back to the fallback model when the stream errors", async () => {
  const failing = new MockLanguageModelV3({ doStream: async () => ({ stream: errorStream() }) });
  const recovered = new MockLanguageModelV3({ doStream: async () => ({ stream: stopStream("recovered") }) });
  const session = createSession("s");
  const events = await collect(
    runAgent(session, "go", {
      model: failing,
      fallbackModel: recovered,
      system: "sys",
      tools: [echo],
      cwd: "/tmp",
    }),
  );

  expect(events.some((event) => event.type === "error")).toBe(false);
  expect(events.at(-1)?.type).toBe("turn_end");
});
