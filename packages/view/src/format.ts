import type { ConnectionStatus } from "@totvibe/protocol";
import type { SandboxStatus } from "@totvibe/sandbox";
import { theme } from "./theme";

export function formatToolInput(input: unknown): string {
  let text: string;
  try {
    text = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    text = String(input);
  }
  return text.length > 96 ? `${text.slice(0, 95)}…` : text;
}

export function pickConnectionColor(connectionStatus: ConnectionStatus): string {
  switch (connectionStatus) {
    case "ok":
      return theme.ok;
    case "checking":
      return theme.checking;
    case "rejected":
      return theme.error;
    default:
      return theme.warn;
  }
}

export function pickConnectionSymbol(connectionStatus: ConnectionStatus): string {
  switch (connectionStatus) {
    case "ok":
      return "●";
    case "checking":
      return "◌";
    case "rejected":
      return "✗";
    case "unreachable":
      return "●";
    default:
      return "○";
  }
}

export function formatConnectionSuffix(connectionStatus: ConnectionStatus): string {
  switch (connectionStatus) {
    case "checking":
      return " (checking…)";
    case "rejected":
      return " (key rejected)";
    case "unreachable":
      return " (unreachable)";
    default:
      return "";
  }
}

export function formatSandboxLabel(sandboxStatus: SandboxStatus | null): string {
  if (!sandboxStatus) return "sandbox: …";
  if (!sandboxStatus.enabled) return "sandbox: off (--no-sandbox)";
  if (!sandboxStatus.available) return "sandbox: off (run build:sandbox)";
  if (!sandboxStatus.hasLandlock) return "sandbox: net-only (no landlock)";
  return sandboxStatus.net === "none" ? "sandbox: fs+net" : "sandbox: fs";
}

export function pickSandboxColor(sandboxStatus: SandboxStatus | null): string {
  if (!sandboxStatus) return theme.muted;
  if (!sandboxStatus.enabled || !sandboxStatus.available || sandboxStatus.degraded) return theme.warn;
  return theme.ok;
}
