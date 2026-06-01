import type { AgentEvent } from "@totvibe/core";
import type { ApprovalRequest } from "@totvibe/safety";
import type { SandboxStatus } from "@totvibe/sandbox";

export type ConnectionStatus = "no-key" | "checking" | "ok" | "rejected" | "unreachable";

export type Role = "user" | "assistant" | "tool";

export interface SessionInfo {
  cwd: string;
  providerName: string;
  modelId: string;
  isProviderDialogOpen: boolean;
}

export type ClientCommand =
  | { type: "submit"; text: string }
  | { type: "cancel" }
  | { type: "approve"; granted: boolean }
  | { type: "select-provider"; providerName: string; modelId: string }
  | { type: "save-api-key"; providerName: string; apiKey: string }
  | { type: "test-connection"; providerName: string };

export type ServerEvent =
  | { type: "init"; session: SessionInfo }
  | { type: "connected-providers"; names: string[] }
  | { type: "agent"; event: AgentEvent }
  | { type: "approval-request"; request: ApprovalRequest | null }
  | { type: "agent-status"; status: string }
  | { type: "streaming"; streaming: boolean }
  | { type: "connection-status"; status: ConnectionStatus }
  | { type: "sandbox-status"; status: SandboxStatus }
  | { type: "provider-changed"; providerName: string; modelId: string }
  | { type: "provider-dialog"; open: boolean }
  | { type: "notice"; text: string }
  | { type: "message"; role: Role; text: string };
