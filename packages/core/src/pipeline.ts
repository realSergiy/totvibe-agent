import type { ToolRisk } from './tool';

export type Middleware = (invocation: ToolInvocation, next: () => Promise<string>) => Promise<string>;

export type ToolInvocation = {
  input: unknown;
  name: string;
  risk: ToolRisk;
};

export const passthrough: Middleware = (_invocation, next) => next();

export const compose = (...middlewares: Middleware[]) => {
  const composed: Middleware = (invocation, next) => {
    let chain = next;
    for (const middleware of middlewares.toReversed()) {
      const downstream = chain;
      chain = () => middleware(invocation, downstream);
    }
    return chain();
  };
  return composed;
};
