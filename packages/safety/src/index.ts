import type { Middleware, ToolRisk } from "@totvibe/core";
import { decidePolicy, resolveAction, type PolicyMode } from "./policy";

export * from "./policy";
export * from "./ledger";

export interface ApprovalRequest {
  name: string;
  risk: ToolRisk;
  input: unknown;
  command?: string;
}

export type ApprovalDecision = "allow" | "deny" | "approved" | "denied" | "timeout";

export interface PolicyDecisionRecord {
  time: string;
  tool: string;
  risk: ToolRisk;
  decision: ApprovalDecision;
  reason: string;
  absolute: boolean;
  input: unknown;
}

export interface PolicyGateOptions {
  approve: (request: ApprovalRequest) => Promise<boolean>;
  mode?: PolicyMode;
  approvalTimeoutMs?: number;
  onDecision?: (record: PolicyDecisionRecord) => void;
}

export function policyGate(options: PolicyGateOptions): Middleware {
  const mode = options.mode ?? "default";
  return async (invocation, next) => {
    const action = resolveAction(invocation.name, invocation.risk, invocation.input);
    const verdict = decidePolicy(action, mode);

    const record = (decision: ApprovalDecision, reason: string): void => {
      options.onDecision?.({
        time: new Date().toISOString(),
        tool: action.name,
        risk: action.risk,
        decision,
        reason,
        absolute: verdict.absolute,
        input: action.input,
      });
    };

    if (verdict.decision === "allow") {
      record("allow", verdict.reason);
      return next();
    }
    if (verdict.decision === "deny") {
      record("deny", verdict.reason);
      return denialFeedback(action.name, verdict.reason, verdict.absolute);
    }

    const granted = await askWithTimeout(
      options.approve,
      { name: action.name, risk: action.risk, input: action.input, command: action.command },
      options.approvalTimeoutMs,
    );
    if (granted === "timeout") {
      record("timeout", "approval timed out");
      return `Approval for "${action.name}" timed out, so it was not run. Continue without it or propose a safer alternative.`;
    }
    if (!granted) {
      record("denied", "the user did not approve it");
      return denialFeedback(action.name, "the user did not approve it", false);
    }
    record("approved", "the user approved it");
    return next();
  };
}

type AskOutcome = boolean | "timeout";

async function askWithTimeout(
  approve: (request: ApprovalRequest) => Promise<boolean>,
  request: ApprovalRequest,
  timeoutMs?: number,
): Promise<AskOutcome> {
  if (!timeoutMs || timeoutMs <= 0) return approve(request);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AskOutcome>((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    return await Promise.race([approve(request), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function denialFeedback(name: string, reason: string, absolute: boolean): string {
  const head = absolute
    ? `Blocked: "${name}" is on the absolute-deny list (${reason}) and cannot be approved.`
    : `Denied: "${name}" was not run (${reason}).`;
  return `${head} Re-read the request and choose a safer approach instead of retrying the same action.`;
}
