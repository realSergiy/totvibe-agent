import type { ToolRisk } from "./tool";

export type Middleware = (
  invocation: ToolInvocation,
  next: () => Promise<string>,
) => Promise<string>;

export type ToolInvocation = {
  input: unknown;
  name: string;
  risk: ToolRisk;
}

export const passthrough: Middleware = (_invocation, next) => next();

export const compose = (...middlewares: Middleware[]) => (invocation, next) =>
    middlewares.reduceRight<() => Promise<string>>(
      (downstream, middleware) => () => middleware(invocation, downstream),
      next,
    )();
