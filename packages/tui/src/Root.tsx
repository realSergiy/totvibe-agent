import { useEffect, useState } from "react";
import { createStore, Provider } from "jotai";
import { createController } from "./agent/controller";
import { ControllerContext } from "./agent/controllerContext";
import type { InitialConfig } from "./providers/config";
import { App } from "./App";

export function Root({ config }: { config: InitialConfig }) {
  const [{ store, controller }] = useState(() => {
    const store = createStore();
    const controller = createController(config, store);
    return { store, controller };
  });

  useEffect(() => {
    controller.start();
  }, [controller]);

  return (
    <Provider store={store}>
      <ControllerContext value={controller}>
        <App />
      </ControllerContext>
    </Provider>
  );
}
