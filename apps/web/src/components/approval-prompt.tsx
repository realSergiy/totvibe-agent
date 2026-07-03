import { formatToolInput, pendingApprovalAtom, theme, useController } from '@totvibe/view';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';

export const ApprovalPrompt = () => {
  const pendingApproval = useAtomValue(pendingApprovalAtom);
  const controller = useController();

  useEffect(() => {
    if (!pendingApproval) return;
    const onKeydown = ({ key }: KeyboardEvent) => {
      if (key === 'y') controller.resolveApproval(true);
      else if (key === 'n' || key === 'Escape') controller.resolveApproval(false);
    };
    globalThis.addEventListener('keydown', onKeydown);
    return () => {
      globalThis.removeEventListener('keydown', onKeydown);
    };
  }, [pendingApproval, controller]);

  if (!pendingApproval) return;

  return (
    <div className="approval" style={{ borderColor: theme.warn }}>
      <div style={{ color: theme.warn }}>Approve {pendingApproval.name}?</div>
      <div style={{ color: theme.muted }}>risk: {pendingApproval.risk}</div>
      <div style={{ color: theme.muted }}>{pendingApproval.command ?? formatToolInput(pendingApproval.input)}</div>
      <div className="field">
        <button
          onClick={() => {
            controller.resolveApproval(true);
          }}
          type="button"
        >
          Run (y)
        </button>
        <button
          onClick={() => {
            controller.resolveApproval(false);
          }}
          type="button"
        >
          Skip (n)
        </button>
      </div>
    </div>
  );
};
