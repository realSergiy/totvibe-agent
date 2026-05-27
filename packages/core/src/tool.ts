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

export function toModelTools(
  definitions: AnyToolDefinition[],
  context: ToolContext,
  middleware: Middleware,
): ToolSet {
  const tools: ToolSet = {};
  for (const definition of definitions) {
    tools[definition.name] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: (input: unknown) => {
        const invocation: ToolInvocation = {
          name: definition.name,
          risk: definition.risk,
          input,
        };
        return middleware(invocation, () => definition.execute(input, context));
      },
    });
  }
  return tools;
}
