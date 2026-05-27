import type { SandboxStatus } from "@totvibe/sandbox";
import type { ProviderInfo } from "./config";

export function StatusBar({
  provider,
  modelId,
  connected,
  cwd,
  status,
  sandbox,
}: {
  provider: ProviderInfo;
  modelId: string;
  connected: boolean;
  cwd: string;
  status: string;
  sandbox: SandboxStatus | null;
}) {
  return (
    <box style={{ flexDirection: "row", gap: 2, padding: 1 }}>
      <text fg="#7dcfff">totvibe</text>
      <text fg={connected ? "#9ece6a" : "#e0af68"}>
        {connected ? "●" : "○"} {provider.name}:{modelId}
      </text>
      <text fg={sandboxColor(sandbox)}>{sandboxLabel(sandbox)}</text>
      <text fg="#565f89">{shorten(cwd)}</text>
      <text fg="#bb9af7">{status}</text>
      <text fg="#565f89">Ctrl+P providers</text>
    </box>
  );
}

function sandboxLabel(sandbox: SandboxStatus | null): string {
  if (!sandbox) return "sandbox: …";
  if (!sandbox.available) return "sandbox: off (run build:sandbox)";
  if (!sandbox.landlock) return "sandbox: net-only (no landlock)";
  return sandbox.net === "none" ? "sandbox: fs+net" : "sandbox: fs";
}

function sandboxColor(sandbox: SandboxStatus | null): string {
  if (!sandbox) return "#565f89";
  if (!sandbox.available || sandbox.degraded) return "#e0af68";
  return "#9ece6a";
}

function shorten(cwd: string): string {
  const home = process.env.HOME;
  return home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}
