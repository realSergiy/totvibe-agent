import { test, expect } from "bun:test";
import { compose, passthrough, type Middleware } from "./pipeline";

test("compose nests middlewares outer-to-inner around next", async () => {
  const log: string[] = [];
  const outer: Middleware = async (_invocation, next) => {
    log.push("outer-before");
    const result = await next();
    log.push("outer-after");
    return result;
  };
  const inner: Middleware = async (_invocation, next) => {
    log.push("inner-before");
    const result = await next();
    log.push("inner-after");
    return result;
  };
  const composed = compose(outer, inner);
  const result = await composed({ name: "t", risk: "read", input: {} }, async () => {
    log.push("run");
    return "done";
  });
  expect(result).toBe("done");
  expect(log).toEqual(["outer-before", "inner-before", "run", "inner-after", "outer-after"]);
});

test("passthrough just calls next", async () => {
  const result = await passthrough({ name: "t", risk: "read", input: {} }, async () => "x");
  expect(result).toBe("x");
});
