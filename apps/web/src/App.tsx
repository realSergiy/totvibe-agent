import {
  isProviderDialogOpenAtom,
  isStreamingAtom,
  pendingApprovalAtom,
  useController,
} from "@totvibe/view";
import { useAtomValue, useStore } from "jotai";
import { useEffect } from "react";

import { ApprovalPrompt } from "./components/ApprovalPrompt";
import { Conversation } from "./components/Conversation";
import { InputBar } from "./components/InputBar";
import { ProviderDialog } from "./components/ProviderDialog";
import { StatusBar } from "./components/StatusBar";

export const App = () => {
  const controller = useController();
  const store = useStore();
  const isProviderDialogOpen = useAtomValue(isProviderDialogOpenAtom);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (store.get(isProviderDialogOpenAtom) || store.get(pendingApprovalAtom)) return;
      if (event.key === "Escape" && store.get(isStreamingAtom)) controller.cancel();
    };
    globalThis.addEventListener("keydown", onKeydown);
    return () => {
      globalThis.removeEventListener("keydown", onKeydown);
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
};
