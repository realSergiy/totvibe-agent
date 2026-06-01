import { useKeyboard } from "@opentui/react";
import { useAtomValue } from "jotai";
import { formatToolInput, pendingApprovalAtom, theme, useController } from "@totvibe/view";

export function ApprovalPrompt() {
  const pendingApproval = useAtomValue(pendingApprovalAtom);
  const controller = useController();

  useKeyboard((key) => {
    if (!pendingApproval) return;
    if (key.name === "y") controller.resolveApproval(true);
    else if (key.name === "n" || key.name === "escape") controller.resolveApproval(false);
  });

  if (!pendingApproval) return null;

  return (
    <box
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.warn,
        padding: 1,
        flexDirection: "column",
      }}
    >
      <text fg={theme.warn}>Approve {pendingApproval.name}?  [y] run   [n] skip</text>
      <text fg={theme.muted}>risk: {pendingApproval.risk}</text>
      <text fg={theme.muted}>{pendingApproval.command ?? formatToolInput(pendingApproval.input)}</text>
    </box>
  );
}
