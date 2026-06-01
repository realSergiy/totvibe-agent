import { useEffect, useState } from "react";
import { createStore, Provider } from "jotai";
import { ControllerContext } from "@totvibe/view";
import type { InitialConfig } from "@totvibe/runtime";
import { createLocalController } from "./agent/createLocalController";
import { App } from "./App";

export function Root({ config }: { config: InitialConfig }) {
  const [{ store, controller, start }] = useState(() => {
    const store = createStore();
    const { controller, start } = createLocalController(config, store);
    return { store, controller, start };
  });

  useEffect(() => {
    start();
  }, [start]);

  return (
    <Provider store={store}>
      <ControllerContext value={controller}>
        <App />
      </ControllerContext>
    </Provider>
  );
}
