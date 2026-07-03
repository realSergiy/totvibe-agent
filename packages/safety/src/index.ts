import type { Middleware, ToolRisk } from '@totvibe/core';

import { decidePolicy, type PolicyMode, resolveAction } from './policy';

export * from './ledger';
export * from './policy';

export type ApprovalDecision = 'allow' | 'approved' | 'denied' | 'deny' | 'timeout';

export type ApprovalRequest = {
  command?: string;
  input: unknown;
  name: string;
  risk: ToolRisk;
};

export type PolicyDecisionRecord = {
  absolute: boolean;
  decision: ApprovalDecision;
  input: unknown;
  reason: string;
  risk: ToolRisk;
  time: string;
  tool: string;
};

export type PolicyGateOptions = {
  approvalTimeoutMs?: number;
  approve: (request: ApprovalRequest) => Promise<boolean>;
  mode?: PolicyMode;
  onDecision?: (record: PolicyDecisionRecord) => void;
};

type AskOutcome = 'timeout' | boolean;

export const policyGate = (options: PolicyGateOptions) => {
  const mode = options.mode ?? 'default';
  const gate: Middleware = async (invocation, next) => {
    const action = resolveAction(invocation.name, invocation.risk, invocation.input);
    const verdict = decidePolicy(action, mode);

    const record = (decision: ApprovalDecision, reason: string) => {
      options.onDecision?.({
        absolute: verdict.absolute,
        decision,
        input: action.input,
        reason,
        risk: action.risk,
        time: new Date().toISOString(),
        tool: action.name,
      });
    };

    if (verdict.decision === 'allow') {
      record('allow', verdict.reason);
      return next();
    }
    if (verdict.decision === 'deny') {
      record('deny', verdict.reason);
      return denialFeedback(action.name, verdict.reason, verdict.absolute);
    }

    const granted = await askWithTimeout(
      options.approve,
      { command: action.command, input: action.input, name: action.name, risk: action.risk },
      options.approvalTimeoutMs,
    );
    if (granted === 'timeout') {
      record('timeout', 'approval timed out');
      return `Approval for "${action.name}" timed out, so it was not run. Continue without it or propose a safer alternative.`;
    }
    if (!granted) {
      record('denied', 'the user did not approve it');
      return denialFeedback(action.name, 'the user did not approve it', false);
    }
    record('approved', 'the user approved it');
    return next();
  };
  return gate;
};

const askWithTimeout = async (
  approve: (request: ApprovalRequest) => Promise<boolean>,
  request: ApprovalRequest,
  timeoutMs?: number,
) => {
  if (!timeoutMs || timeoutMs <= 0) return approve(request);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AskOutcome>(resolve => {
    timer = setTimeout(() => {
      resolve('timeout');
    }, timeoutMs);
  });
  try {
    return await Promise.race([approve(request), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const denialFeedback = (name: string, reason: string, isAbsolute: boolean) => {
  const head = isAbsolute
    ? `Blocked: "${name}" is on the absolute-deny list (${reason}) and cannot be approved.`
    : `Denied: "${name}" was not run (${reason}).`;
  return `${head} Re-read the request and choose a safer approach instead of retrying the same action.`;
};
