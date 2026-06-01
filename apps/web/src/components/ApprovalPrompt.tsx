import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { formatToolInput, pendingApprovalAtom, theme, useController } from "@totvibe/view";

export function ApprovalPrompt() {
  const pendingApproval = useAtomValue(pendingApprovalAtom);
  const controller = useController();

  useEffect(() => {
    if (!pendingApproval) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "y") controller.resolveApproval(true);
      else if (event.key === "n" || event.key === "Escape") controller.resolveApproval(false);
    };
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [pendingApproval, controller]);

  if (!pendingApproval) return null;

  return (
    <div className="approval" style={{ borderColor: theme.warn }}>
      <div style={{ color: theme.warn }}>Approve {pendingApproval.name}?</div>
      <div style={{ color: theme.muted }}>risk: {pendingApproval.risk}</div>
      <div style={{ color: theme.muted }}>
        {pendingApproval.command ?? formatToolInput(pendingApproval.input)}
      </div>
      <div className="field">
        <button
          type="button"
          onClick={() => {
            controller.resolveApproval(true);
          }}
        >
          Run (y)
        </button>
        <button
          type="button"
          onClick={() => {
            controller.resolveApproval(false);
          }}
        >
          Skip (n)
        </button>
      </div>
    </div>
  );
}
