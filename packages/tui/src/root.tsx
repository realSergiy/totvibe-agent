import { useState } from "react";
import { getDefaultStore } from "jotai";
import { createController } from "./agent/controller";
import { ControllerProvider } from "./agent/context";
import { configAtom } from "./state/session";
import type { InitialConfig } from "./providers/config";
import { App } from "./app";

export function TotvibeApp({ config }: { config: InitialConfig }) {
  const [controller] = useState(() => {
    const store = getDefaultStore();
    store.set(configAtom, config);
    const controller = createController(config, store);
    controller.init();
    return controller;
  });

  return (
    <ControllerProvider controller={controller}>
      <App />
    </ControllerProvider>
  );
}
