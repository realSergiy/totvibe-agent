import type { InitialConfig } from '@totvibe/runtime';

import { ControllerContext } from '@totvibe/view';
import { createStore, Provider } from 'jotai';
import { useEffect, useState } from 'react';

import { createLocalController } from './agent/createLocalController';
import { App } from './App';

export const Root = ({ config }: { config: InitialConfig }) => {
  const [{ controller, start, store }] = useState(() => {
    const store = createStore();
    const { controller, start } = createLocalController(config, store);
    return { controller, start, store };
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
};
