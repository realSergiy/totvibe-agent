import type { Middleware } from "@totvibe/core";

export interface ApprovalRequest {
  name: string;
  input: unknown;
}

export interface ApprovalGateOptions {
  approve: (request: ApprovalRequest) => Promise<boolean>;
  autoApprove?: boolean;
}

export function approvalGate({ approve, autoApprove = false }: ApprovalGateOptions): Middleware {
  return async (invocation, next) => {
    if (invocation.risk === "read" || autoApprove) return next();

    const granted = await approve({ name: invocation.name, input: invocation.input });
    if (!granted) {
      return `Denied by the user: "${invocation.name}" was not executed. Re-read the request and choose a safer approach instead of retrying the same action.`;
    }
    return next();
  };
}
