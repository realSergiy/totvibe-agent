import type { SandboxStatus } from "@totvibe/sandbox";
import type { ProviderInfo } from "./config";

export type ConnectionStatus = "no-key" | "checking" | "ok" | "rejected" | "unreachable";

export function StatusBar({
  provider,
  modelId,
  connection,
  cwd,
  status,
  sandbox,
}: {
  provider: ProviderInfo;
  modelId: string;
  connection: ConnectionStatus;
  cwd: string;
  status: string;
  sandbox: SandboxStatus | null;
}) {
  return (
    <box style={{ flexDirection: "row", gap: 2, padding: 1 }}>
      <text fg="#7dcfff">totvibe</text>
      <text fg={connectionColor(connection)}>
        {connectionSymbol(connection)} {provider.name}:{modelId}
        {connectionSuffix(connection)}
      </text>
      <text fg={sandboxColor(sandbox)}>{sandboxLabel(sandbox)}</text>
      <text fg="#565f89">{shorten(cwd)}</text>
      <text fg="#bb9af7">{status}</text>
      <text fg="#565f89">/provider to connect</text>
    </box>
  );
}

function connectionColor(connection: ConnectionStatus): string {
  switch (connection) {
    case "ok":
      return "#9ece6a";
    case "checking":
      return "#7dcfff";
    case "rejected":
      return "#f7768e";
    default:
      return "#e0af68";
  }
}

function connectionSymbol(connection: ConnectionStatus): string {
  switch (connection) {
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

function connectionSuffix(connection: ConnectionStatus): string {
  switch (connection) {
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

function sandboxLabel(sandbox: SandboxStatus | null): string {
  if (!sandbox) return "sandbox: …";
  if (!sandbox.enabled) return "sandbox: off (--no-sandbox)";
  if (!sandbox.available) return "sandbox: off (run build:sandbox)";
  if (!sandbox.hasLandlock) return "sandbox: net-only (no landlock)";
  return sandbox.net === "none" ? "sandbox: fs+net" : "sandbox: fs";
}

function sandboxColor(sandbox: SandboxStatus | null): string {
  if (!sandbox) return "#565f89";
  if (!sandbox.enabled || !sandbox.available || sandbox.degraded) return "#e0af68";
  return "#9ece6a";
}

function shorten(cwd: string): string {
  const home = process.env.HOME;
  return home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}
