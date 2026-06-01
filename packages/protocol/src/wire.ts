import type { AgentEvent } from "@totvibe/core";
import type { ApprovalRequest } from "@totvibe/safety";
import type { SandboxStatus } from "@totvibe/sandbox";

export type ClientCommand =
  | { apiKey: string; providerName: string; type: "save-api-key"; }
  | { granted: boolean; type: "approve"; }
  | { modelId: string; providerName: string; type: "select-provider"; }
  | { providerName: string; type: "test-connection"; }
  | { text: string; type: "submit"; }
  | { type: "cancel" };

export type ConnectionStatus = "checking" | "no-key" | "ok" | "rejected" | "unreachable";

export type Role = "assistant" | "tool" | "user";

export type ServerEvent =
  | { event: AgentEvent; type: "agent"; }
  | { modelId: string; providerName: string; type: "provider-changed"; }
  | { names: string[]; type: "connected-providers"; }
  | { open: boolean; type: "provider-dialog"; }
  | { request: ApprovalRequest | null; type: "approval-request"; }
  | { role: Role; text: string; type: "message"; }
  | { session: SessionInfo; type: "init"; }
  | { status: ConnectionStatus; type: "connection-status"; }
  | { status: SandboxStatus; type: "sandbox-status"; }
  | { status: string; type: "agent-status"; }
  | { streaming: boolean; type: "streaming"; }
  | { text: string; type: "notice"; };

export type SessionInfo = {
  cwd: string;
  isProviderDialogOpen: boolean;
  modelId: string;
  providerName: string;
}
