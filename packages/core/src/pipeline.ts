import type { ToolRisk } from "./tool";

export interface ToolInvocation {
  name: string;
  risk: ToolRisk;
  input: unknown;
}

export type Middleware = (
  invocation: ToolInvocation,
  next: () => Promise<string>,
) => Promise<string>;

export const passthrough: Middleware = (_invocation, next) => next();

export function compose(...middlewares: Middleware[]): Middleware {
  return (invocation, next) =>
    middlewares.reduceRight<() => Promise<string>>(
      (downstream, middleware) => () => middleware(invocation, downstream),
      next,
    )();
}
