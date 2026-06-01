import { useAtomValue } from "jotai";
import {
  agentStatusAtom,
  connectionStatusAtom,
  cwdAtom,
  formatConnectionSuffix,
  formatSandboxLabel,
  modelIdAtom,
  pickConnectionColor,
  pickConnectionSymbol,
  pickSandboxColor,
  providerAtom,
  sandboxStatusAtom,
  theme,
} from "@totvibe/view";

export function StatusBar() {
  const provider = useAtomValue(providerAtom);
  const modelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const agentStatus = useAtomValue(agentStatusAtom);
  const sandboxStatus = useAtomValue(sandboxStatusAtom);
  const cwd = useAtomValue(cwdAtom);

  return (
    <box style={{ flexDirection: "row", gap: 2, padding: 1 }}>
      <text fg={theme.brand}>totvibe</text>
      <text fg={pickConnectionColor(connectionStatus)}>
        {pickConnectionSymbol(connectionStatus)} {provider.name}:{modelId}
        {formatConnectionSuffix(connectionStatus)}
      </text>
      <text fg={pickSandboxColor(sandboxStatus)}>{formatSandboxLabel(sandboxStatus)}</text>
      <text fg={theme.muted}>{cwd}</text>
      <text fg={theme.highlight}>{agentStatus}</text>
      <text fg={theme.muted}>/provider to connect</text>
    </box>
  );
}
