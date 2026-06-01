import { useKeyboard, useRenderer } from "@opentui/react";
import { useAtomValue, useStore } from "jotai";
import {
  isProviderDialogOpenAtom,
  isStreamingAtom,
  pendingApprovalAtom,
  useController,
} from "@totvibe/view";
import { StatusBar } from "./components/StatusBar";
import { Conversation } from "./components/Conversation";
import { InputBar } from "./components/InputBar";
import { ApprovalPrompt } from "./components/ApprovalPrompt";
import { ProviderDialog } from "./components/ProviderDialog";

export function App() {
  const renderer = useRenderer();
  const controller = useController();
  const store = useStore();
  const isProviderDialogOpen = useAtomValue(isProviderDialogOpenAtom);

  useKeyboard((key) => {
    if (key.name === "c" && key.ctrl) {
      renderer.destroy();
      process.exit(0);
    }
    if (store.get(isProviderDialogOpenAtom) || store.get(pendingApprovalAtom)) return;
    if (key.name === "escape" && store.get(isStreamingAtom)) controller.cancel();
  });

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <StatusBar />
      <Conversation />
      <ApprovalPrompt />
      {isProviderDialogOpen ? <ProviderDialog /> : <InputBar />}
    </box>
  );
}
