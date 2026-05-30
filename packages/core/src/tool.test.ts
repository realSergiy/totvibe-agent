import { test, expect } from "bun:test";
import { z } from "zod";
import { passthrough, type Middleware } from "./pipeline";
import {
  buildModelToolSet,
  defineTool,
  executeToolCall,
  runToolCalls,
  type AnyToolDef,
  type ToolContext,
} from "./tool";

const context: ToolContext = { cwd: "/tmp" };

function makeTool(
  name: string,
  risk: "read" | "mutate",
  execute: (input: { value?: string }) => Promise<string>,
): AnyToolDef {
  return defineTool({
    name,
    description: name,
    risk,
    inputSchema: z.object({ value: z.string().optional() }),
    execute,
  });
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

test("buildModelToolSet exposes schemas only, never an executor", () => {
  const toolSet = buildModelToolSet([makeTool("a", "read", async () => "x")]);
  expect(Object.keys(toolSet)).toEqual(["a"]);
  expect((toolSet.a as { execute?: unknown }).execute).toBeUndefined();
});

test("executeToolCall runs through middleware and returns text", async () => {
  const tool = makeTool(
    "read_thing",
    "read",
    async (input) => `got ${JSON.stringify(input)}`,
  );
  const outcome = await executeToolCall(
    [tool],
    { toolCallId: "1", toolName: "read_thing", input: { value: "hi" } },
    context,
    passthrough,
  );
  expect(outcome.isError).toBe(false);
  expect(outcome.text).toContain("hi");
});

test("executeToolCall reports an unknown tool as an error", async () => {
  const outcome = await executeToolCall(
    [],
    { toolCallId: "1", toolName: "missing", input: {} },
    context,
    passthrough,
  );
  expect(outcome.isError).toBe(true);
  expect(outcome.text).toContain("Unknown tool");
});

test("executeToolCall surfaces a thrown error as isError", async () => {
  const tool = makeTool("boom", "mutate", async () => {
    throw new Error("nope");
  });
  const outcome = await executeToolCall(
    [tool],
    { toolCallId: "1", toolName: "boom", input: {} },
    context,
    passthrough,
  );
  expect(outcome.isError).toBe(true);
  expect(outcome.text).toBe("nope");
});

test("a middleware denial is fed back as non-error feedback", async () => {
  const deny: Middleware = async () => "Denied: not run.";
  const tool = makeTool("w", "mutate", async () => "wrote");
  const outcome = await executeToolCall(
    [tool],
    { toolCallId: "1", toolName: "w", input: {} },
    context,
    deny,
  );
  expect(outcome.isError).toBe(false);
  expect(outcome.text).toContain("Denied");
});

test("runToolCalls runs read-only calls in parallel and serializes mutations", async () => {
  const order: string[] = [];
  const traced = (name: string, risk: "read" | "mutate") =>
    makeTool(name, risk, async () => {
      order.push(`start ${name}`);
      await delay(15);
      order.push(`end ${name}`);
      return name;
    });

  const reads = [traced("ra", "read"), traced("rb", "read")];
  const readOutcomes = await runToolCalls(
    reads,
    [
      { toolCallId: "1", toolName: "ra", input: {} },
      { toolCallId: "2", toolName: "rb", input: {} },
    ],
    context,
    passthrough,
  );
  expect(readOutcomes.map((outcome) => outcome.toolName)).toEqual(["ra", "rb"]);
  expect(order.indexOf("start rb")).toBeLessThan(order.indexOf("end ra"));

  order.length = 0;
  const writes = [traced("wa", "mutate"), traced("wb", "mutate")];
  await runToolCalls(
    writes,
    [
      { toolCallId: "1", toolName: "wa", input: {} },
      { toolCallId: "2", toolName: "wb", input: {} },
    ],
    context,
    passthrough,
  );
  expect(order.indexOf("end wa")).toBeLessThan(order.indexOf("start wb"));
});

