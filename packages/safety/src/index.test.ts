import { test, expect } from "bun:test";
import type { ToolInvocation } from "@totvibe/core";
import { policyGate, type PolicyDecisionRecord } from "./index";

const invocation = (name: string, risk: "read" | "mutate", input: unknown): ToolInvocation => ({
  name,
  risk,
  input,
});

test("read-only calls pass the gate without asking", async () => {
  const gate = policyGate({ approve: async () => false });
  const result = await gate(invocation("read_file", "read", { path: "a" }), async () => "READ");
  expect(result).toBe("READ");
});

test("auto mode runs mutations but never crosses absolute deny", async () => {
  const records: PolicyDecisionRecord[] = [];
  const gate = policyGate({ approve: async () => false, mode: "auto", onDecision: (record) => records.push(record) });

  expect(await gate(invocation("write_file", "mutate", { path: "a", content: "x" }), async () => "WROTE")).toBe("WROTE");

  const blocked = await gate(invocation("run_bash", "mutate", { command: "rm -rf /" }), async () => "RAN");
  expect(blocked).toContain("absolute-deny");
  expect(records.at(-1)).toMatchObject({ decision: "deny", absolute: true });
});

test("approval grants run the tool; denials feed back", async () => {
  const yes = policyGate({ approve: async () => true });
  expect(await yes(invocation("write_file", "mutate", { path: "a", content: "x" }), async () => "WROTE")).toBe("WROTE");

  const no = policyGate({ approve: async () => false });
  expect(await no(invocation("write_file", "mutate", { path: "a", content: "x" }), async () => "WROTE")).toContain(
    "Denied",
  );
});

test("a slow approval times out into feedback without running the tool", async () => {
  let ran = false;
  const gate = policyGate({ approve: () => new Promise<boolean>(() => {}), approvalTimeoutMs: 20 });
  const result = await gate(invocation("write_file", "mutate", { path: "a", content: "x" }), async () => {
    ran = true;
    return "WROTE";
  });
  expect(ran).toBe(false);
  expect(result).toContain("timed out");
});
