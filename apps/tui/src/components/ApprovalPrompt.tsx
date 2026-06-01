import { useKeyboard } from '@opentui/react';
import { formatToolInput, pendingApprovalAtom, theme, useController } from '@totvibe/view';
import { useAtomValue } from 'jotai';

export const ApprovalPrompt = () => {
  const pendingApproval = useAtomValue(pendingApprovalAtom);
  const controller = useController();

  useKeyboard(key => {
    if (!pendingApproval) return;
    if (key.name === 'y') controller.resolveApproval(true);
    else if (key.name === 'n' || key.name === 'escape') controller.resolveApproval(false);
  });

  if (!pendingApproval) return;

  return (
    <box
      style={{
        border: true,
        borderColor: theme.warn,
        borderStyle: 'rounded',
        flexDirection: 'column',
        padding: 1,
      }}
    >
      <text fg={theme.warn}>Approve {pendingApproval.name}? [y] run [n] skip</text>
      <text fg={theme.muted}>risk: {pendingApproval.risk}</text>
      <text fg={theme.muted}>{pendingApproval.command ?? formatToolInput(pendingApproval.input)}</text>
    </box>
  );
};
