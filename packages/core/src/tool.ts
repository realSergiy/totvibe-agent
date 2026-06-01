import type { ZodType } from "zod";

import type { Middleware, ToolInvocation } from "./pipeline";

import { tool, type ToolSet } from "./ai-core";

export type AnyToolDef = ToolDef;

export type ToolCallOutcome = {
  isError: boolean;
  text: string;
  toolCallId: string;
  toolName: string;
}

export type ToolCallRequest = {
  input: unknown;
  toolCallId: string;
  toolName: string;
}

export type ToolContext = {
  cwd: string;
  signal?: AbortSignal;
}

export type ToolDef<Input = unknown> = {
  description: string;
  execute(input: Input, context: ToolContext): Promise<string>;
  inputSchema: ZodType<Input>;
  name: string;
  risk: ToolRisk;
}

export type ToolRisk = "mutate" | "read";

export const buildModelToolSet = (definitions: AnyToolDef[]) => {
  const toolSet: ToolSet = {};
  for (const definition of definitions) {
    toolSet[definition.name] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
    });
  }
  return toolSet;
};

export const defineTool = <Input>(definition: ToolDef<Input>): ToolDef<Input> => definition;

export const executeToolCall = async (definitions: AnyToolDef[], call: ToolCallRequest, context: ToolContext, middleware: Middleware) => {
  const definition = findToolDefinition(definitions, call.toolName);
  if (!definition) {
    return {
      isError: true,
      text: `Unknown tool "${call.toolName}". Call one of the available tools instead.`,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
    };
  }
  const invocation: ToolInvocation = {
    input: call.input,
    name: definition.name,
    risk: definition.risk,
  };
  try {
    const text = await middleware(invocation, () =>
      definition.execute(call.input, context),
    );
    return {
      isError: false,
      text,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      text,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
    };
  }
};

export const findToolDefinition = (definitions: AnyToolDef[], name: string) => definitions.find((definition) => definition.name === name);

export const isReadOnly = (definition: AnyToolDef) => definition.risk === "read";

export const runToolCalls = async (definitions: AnyToolDef[], calls: ToolCallRequest[], context: ToolContext, middleware: Middleware) => {
  const outcomes = Array.from({length: calls.length});
  let index = 0;
  while (index < calls.length) {
    const call = calls[index];
    if (!call) break;
    const definition = findToolDefinition(definitions, call.toolName);
    if (definition && isReadOnly(definition)) {
      const batchStart = index;
      const batch: Promise<ToolCallOutcome>[] = [];
      while (index < calls.length) {
        const batchCall = calls[index];
        if (!batchCall) break;
        const nextToolDef = findToolDefinition(definitions, batchCall.toolName);
        if (!nextToolDef || !isReadOnly(nextToolDef)) break;
        batch.push(executeToolCall(definitions, batchCall, context, middleware));
        index += 1;
      }
      const settled = await Promise.all(batch);
      for (const [offset, outcome] of settled.entries()) {
        outcomes[batchStart + offset] = outcome;
      }
    } else {
      outcomes[index] = await executeToolCall(definitions, call, context, middleware);
      index += 1;
    }
  }
  return outcomes;
};

