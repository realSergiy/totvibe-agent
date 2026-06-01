import { applyServerEvent, type AgentController, type Store } from "@totvibe/view";
import { createRuntime, type InitialConfig } from "@totvibe/runtime";
import { openKeyPage } from "../actions";

export interface LocalController {
  controller: AgentController;
  start: () => void;
}

export function createLocalController(config: InitialConfig, store: Store): LocalController {
  const runtime = createRuntime(config);
  runtime.subscribe((event) => {
    applyServerEvent(store, event);
  });

  const controller: AgentController = {
    submit: (text) => {
      runtime.submit(text);
    },
    cancel: () => {
      runtime.cancel();
    },
    resolveApproval: (granted) => {
      runtime.resolveApproval(granted);
    },
    selectProvider: (providerName, modelId) => {
      runtime.selectProvider(providerName, modelId);
    },
    saveApiKey: (providerName, apiKey) => {
      void runtime.saveApiKey(providerName, apiKey);
    },
    testConnection: (providerName) => {
      void runtime.testConnection(providerName);
    },
    openKeyPage,
  };

  return {
    controller,
    start: () => {
      runtime.start();
    },
  };
}
