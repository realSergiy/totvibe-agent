import { useEffect, useState } from "react";
import { createStore, Provider } from "jotai";
import { ControllerContext, type AgentController, type Store } from "@totvibe/view";
import { createSocketController } from "./createSocketController";
import { App } from "./App";

export interface RootProps {
  create?: (store: Store) => { controller: AgentController; start: () => void };
}

export function Root({ create = createSocketController }: RootProps) {
  const [{ store, controller, start }] = useState(() => {
    const store = createStore();
    const built = create(store);
    return { store, controller: built.controller, start: built.start };
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
