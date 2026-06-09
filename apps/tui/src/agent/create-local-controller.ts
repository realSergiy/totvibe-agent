import { createRuntime, type InitialConfig } from '@totvibe/runtime';
import { type AgentController, applyServerEvent, type Store } from '@totvibe/view';

import { openKeyPage } from '@/actions';

type LocalController = {
  controller: AgentController;
  start: () => void;
};

export const createLocalController = (config: InitialConfig, store: Store) => {
  const runtime = createRuntime(config);
  runtime.subscribe(event => {
    applyServerEvent(store, event);
  });

  const controller: AgentController = {
    cancel: () => {
      runtime.cancel();
    },
    openKeyPage,
    resolveApproval: granted => {
      runtime.resolveApproval(granted);
    },
    saveApiKey: (providerName, apiKey) => {
      void runtime.saveApiKey(providerName, apiKey);
    },
    selectProvider: (providerName, modelId) => {
      runtime.selectProvider(providerName, modelId);
    },
    submit: text => {
      runtime.submit(text);
    },
    testConnection: providerName => {
      void runtime.testConnection(providerName);
    },
  };

  return {
    controller,
    start: () => {
      runtime.start();
    },
  } satisfies LocalController;
};
