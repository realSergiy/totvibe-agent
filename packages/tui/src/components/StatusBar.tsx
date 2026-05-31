import { useAtomValue } from "jotai";
import type { SandboxStatus } from "@totvibe/sandbox";
import {
  connectionStatusAtom,
  modelIdAtom,
  providerAtom,
  type ConnectionStatus,
} from "../state/providers";
import { agentStatusAtom, configAtom, sandboxStatusAtom } from "../state/session";
import { theme } from "../theme";

export function StatusBar() {
  const provider = useAtomValue(providerAtom);
  const modelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const agentStatus = useAtomValue(agentStatusAtom);
  const sandboxStatus = useAtomValue(sandboxStatusAtom);
  const config = useAtomValue(configAtom);

  return (
    <box style={{ flexDirection: "row", gap: 2, padding: 1 }}>
      <text fg={theme.brand}>totvibe</text>
      <text fg={pickConnectionColor(connectionStatus)}>
        {pickConnectionSymbol(connectionStatus)} {provider.name}:{modelId}
        {formatConnectionSuffix(connectionStatus)}
      </text>
      <text fg={pickSandboxColor(sandboxStatus)}>{formatSandboxLabel(sandboxStatus)}</text>
      <text fg={theme.muted}>{shortenPath(config?.cwd ?? "")}</text>
      <text fg={theme.highlight}>{agentStatus}</text>
      <text fg={theme.muted}>/provider to connect</text>
    </box>
  );
}

function pickConnectionColor(connectionStatus: ConnectionStatus): string {
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

function pickConnectionSymbol(connectionStatus: ConnectionStatus): string {
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

function formatConnectionSuffix(connectionStatus: ConnectionStatus): string {
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

function formatSandboxLabel(sandboxStatus: SandboxStatus | null): string {
  if (!sandboxStatus) return "sandbox: …";
  if (!sandboxStatus.enabled) return "sandbox: off (--no-sandbox)";
  if (!sandboxStatus.available) return "sandbox: off (run build:sandbox)";
  if (!sandboxStatus.hasLandlock) return "sandbox: net-only (no landlock)";
  return sandboxStatus.net === "none" ? "sandbox: fs+net" : "sandbox: fs";
}

function pickSandboxColor(sandboxStatus: SandboxStatus | null): string {
  if (!sandboxStatus) return theme.muted;
  if (!sandboxStatus.enabled || !sandboxStatus.available || sandboxStatus.degraded) return theme.warn;
  return theme.ok;
}

function shortenPath(path: string): string {
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}
