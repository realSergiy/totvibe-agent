import { type AgentController, ControllerContext, type Store } from '@totvibe/view';
import { createStore, Provider } from 'jotai';
import { useEffect, useState } from 'react';

import { App } from './app';
import { createSocketController } from './create-socket-controller';

export type RootProps = {
  create?: (store: Store) => { controller: AgentController; start: () => void };
};

export const Root = ({ create = createSocketController }: RootProps) => {
  const [{ controller, start, store }] = useState(() => {
    const store = createStore();
    const built = create(store);
    return { controller: built.controller, start: built.start, store };
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
