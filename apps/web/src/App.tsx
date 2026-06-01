import { useEffect } from "react";
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
  const controller = useController();
  const store = useStore();
  const isProviderDialogOpen = useAtomValue(isProviderDialogOpenAtom);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (store.get(isProviderDialogOpenAtom) || store.get(pendingApprovalAtom)) return;
      if (event.key === "Escape" && store.get(isStreamingAtom)) controller.cancel();
    };
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [store, controller]);

  return (
    <div className="app">
      <StatusBar />
      <Conversation />
      <ApprovalPrompt />
      {isProviderDialogOpen ? <ProviderDialog /> : <InputBar />}
    </div>
  );
}
