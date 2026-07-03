import type { ZodType } from 'zod';

import type { Middleware, ToolInvocation } from './pipeline';

import { tool, type ToolSet } from './ai-core';

export type AnyToolDef = ToolDef;

export type ToolCallOutcome = {
  isError: boolean;
  text: string;
  toolCallId: string;
  toolName: string;
};

export type ToolCallRequest = {
  input: unknown;
  toolCallId: string;
  toolName: string;
};

export type ToolContext = {
  cwd: string;
  signal?: AbortSignal;
};

export type ToolDef<Input = unknown> = {
  description: string;
  execute(input: Input, context: ToolContext): Promise<string>;
  inputSchema: ZodType<Input>;
  name: string;
  risk: ToolRisk;
};

export type ToolRisk = 'mutate' | 'read';

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

export const executeToolCall = async (
  definitions: AnyToolDef[],
  { input, toolCallId, toolName }: ToolCallRequest,
  context: ToolContext,
  middleware: Middleware,
) => {
  const definition = findToolDefinition(definitions, toolName);
  if (!definition) {
    return {
      isError: true,
      text: `Unknown tool "${toolName}". Call one of the available tools instead.`,
      toolCallId: toolCallId,
      toolName: toolName,
    };
  }
  const invocation: ToolInvocation = {
    input: input,
    name: definition.name,
    risk: definition.risk,
  };
  try {
    const text = await middleware(invocation, () => definition.execute(input, context));
    return {
      isError: false,
      text,
      toolCallId: toolCallId,
      toolName: toolName,
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      text,
      toolCallId: toolCallId,
      toolName: toolName,
    };
  }
};

export const findToolDefinition = (definitions: AnyToolDef[], name: string) =>
  definitions.find(definition => definition.name === name);

export const isReadOnly = ({ risk }: AnyToolDef) => risk === 'read';

const collectReadOnlyBatch = (
  definitions: AnyToolDef[],
  calls: ToolCallRequest[],
  startIndex: number,
  context: ToolContext,
  middleware: Middleware,
) => {
  const batch: Promise<ToolCallOutcome>[] = [];
  let index = startIndex;
  while (index < calls.length) {
    const batchCall = calls[index];
    if (!batchCall) return { batch, nextIndex: index };
    const nextToolDef = findToolDefinition(definitions, batchCall.toolName);
    if (!nextToolDef || !isReadOnly(nextToolDef)) return { batch, nextIndex: index };
    batch.push(executeToolCall(definitions, batchCall, context, middleware));
    index += 1;
  }
  return { batch, nextIndex: index };
};

export const runToolCalls = async (
  definitions: AnyToolDef[],
  calls: ToolCallRequest[],
  context: ToolContext,
  middleware: Middleware,
) => {
  const outcomes: ToolCallOutcome[] = [];
  let index = 0;
  while (index < calls.length) {
    const call = calls[index];
    if (!call) break;
    const definition = findToolDefinition(definitions, call.toolName);
    if (definition && isReadOnly(definition)) {
      const batchStart = index;
      const { batch, nextIndex } = collectReadOnlyBatch(definitions, calls, index, context, middleware);
      index = nextIndex;
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
