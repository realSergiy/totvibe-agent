import type { ClientCommand, ServerEvent } from "@totvibe/protocol";

import { type AgentController, applyServerEvent, type Store } from "@totvibe/view";

export type WebController = {
  controller: AgentController;
  start(): void;
}

export const createSocketController = (store: Store) => {
  const socketUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  let socket: null | WebSocket = null;
  const send = (command: ClientCommand): void => {
    socket?.send(JSON.stringify(command));
  };

  const controller: AgentController = {
    cancel: () => {
      send({ type: "cancel" });
    },
    openKeyPage: (url) => {
      window.open(url, "_blank", "noopener");
    },
    resolveApproval: (granted) => {
      send({ granted, type: "approve" });
    },
    saveApiKey: (providerName, apiKey) => {
      send({ apiKey, providerName, type: "save-api-key" });
    },
    selectProvider: (providerName, modelId) => {
      send({ modelId, providerName, type: "select-provider" });
    },
    submit: (text) => {
      send({ text, type: "submit" });
    },
    testConnection: (providerName) => {
      send({ providerName, type: "test-connection" });
    },
  };

  return {
    controller,
    start: () => {
      socket = new WebSocket(socketUrl);
      socket.onmessage = (event) => {
        applyServerEvent(store, JSON.parse(event.data as string) as ServerEvent);
      };
    },
  };
};
