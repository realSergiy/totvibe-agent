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
} from '@totvibe/view';
import { useAtomValue } from 'jotai';

export const StatusBar = () => {
  const provider = useAtomValue(providerAtom);
  const modelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const agentStatus = useAtomValue(agentStatusAtom);
  const sandboxStatus = useAtomValue(sandboxStatusAtom);
  const cwd = useAtomValue(cwdAtom);

  return (
    <div className="status-bar">
      <span style={{ color: theme.brand }}>totvibe</span>
      <span style={{ color: pickConnectionColor(connectionStatus) }}>
        {pickConnectionSymbol(connectionStatus)} {provider.name}:{modelId}
        {formatConnectionSuffix(connectionStatus)}
      </span>
      <span style={{ color: pickSandboxColor(sandboxStatus) }}>{formatSandboxLabel(sandboxStatus)}</span>
      <span style={{ color: theme.muted }}>{cwd}</span>
      <span style={{ color: theme.highlight }}>{agentStatus}</span>
      <span style={{ color: theme.muted }}>/provider to connect</span>
    </div>
  );
};
