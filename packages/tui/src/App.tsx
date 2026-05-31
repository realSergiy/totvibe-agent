import { useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { getDefaultStore, useAtomValue, useStore } from "jotai";
import { isProviderDialogOpenAtom } from "./state/ui";
import { isStreamingAtom, pendingApprovalAtom } from "./state/session";
import { getController, initController } from "./agent/controller";
import type { InitialConfig } from "./providers/config";
import { StatusBar } from "./components/StatusBar";
import { Conversation } from "./components/Conversation";
import { InputBar } from "./components/InputBar";
import { ApprovalPrompt } from "./components/ApprovalPrompt";
import { ProviderDialog } from "./components/ProviderDialog";

export function App({ config }: { config: InitialConfig }) {
  useState(() => initController(config, getDefaultStore()));
  const renderer = useRenderer();
  const controller = getController();
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
