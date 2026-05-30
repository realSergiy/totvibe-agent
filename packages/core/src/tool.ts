import { tool, type ToolSet } from "ai";
import type { ZodType } from "zod";
import type { Middleware, ToolInvocation } from "./pipeline";

export type ToolRisk = "read" | "mutate";

export interface ToolContext {
  cwd: string;
  signal?: AbortSignal;
}

export interface ToolDefinition<Input = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<Input>;
  risk: ToolRisk;
  execute: (input: Input, context: ToolContext) => Promise<string>;
}

export type AnyToolDefinition = ToolDefinition<any>;

export function defineTool<Input>(definition: ToolDefinition<Input>): ToolDefinition<Input> {
  return definition;
}

export function isReadOnly(definition: AnyToolDefinition): boolean {
  return definition.risk === "read";
}

export function findToolDefinition(
  definitions: AnyToolDefinition[],
  name: string,
): AnyToolDefinition | undefined {
  return definitions.find((definition) => definition.name === name);
}

export function buildModelToolSet(definitions: AnyToolDefinition[]): ToolSet {
  const toolSet: ToolSet = {};
  for (const definition of definitions) {
    toolSet[definition.name] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
    });
  }
  return toolSet;
}

export interface ToolCallRequest {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface ToolCallOutcome {
  toolCallId: string;
  toolName: string;
  text: string;
  isError: boolean;
}

export async function executeToolCall(
  definitions: AnyToolDefinition[],
  call: ToolCallRequest,
  context: ToolContext,
  middleware: Middleware,
): Promise<ToolCallOutcome> {
  const definition = findToolDefinition(definitions, call.toolName);
  if (!definition) {
    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      text: `Unknown tool "${call.toolName}". Call one of the available tools instead.`,
      isError: true,
    };
  }
  const invocation: ToolInvocation = {
    name: definition.name,
    risk: definition.risk,
    input: call.input,
  };
  try {
    const text = await middleware(invocation, () => definition.execute(call.input, context));
    return { toolCallId: call.toolCallId, toolName: call.toolName, text, isError: false };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { toolCallId: call.toolCallId, toolName: call.toolName, text, isError: true };
  }
}

export async function runToolCalls(
  definitions: AnyToolDefinition[],
  calls: ToolCallRequest[],
  context: ToolContext,
  middleware: Middleware,
): Promise<ToolCallOutcome[]> {
  const outcomes = new Array<ToolCallOutcome>(calls.length);
  let index = 0;
  while (index < calls.length) {
    const definition = findToolDefinition(definitions, calls[index]!.toolName);
    if (definition && isReadOnly(definition)) {
      const batchStart = index;
      const batch: Array<Promise<ToolCallOutcome>> = [];
      while (index < calls.length) {
        const next = findToolDefinition(definitions, calls[index]!.toolName);
        if (!next || !isReadOnly(next)) break;
        batch.push(executeToolCall(definitions, calls[index]!, context, middleware));
        index += 1;
      }
      const settled = await Promise.all(batch);
      settled.forEach((outcome, offset) => {
        outcomes[batchStart + offset] = outcome;
      });
    } else {
      outcomes[index] = await executeToolCall(definitions, calls[index]!, context, middleware);
      index += 1;
    }
  }
  return outcomes;
}
