import { applyServerEvent, type AgentController, type Store } from "@totvibe/view";
import type { ClientCommand, ServerEvent } from "@totvibe/protocol";

export interface WebController {
  controller: AgentController;
  start(): void;
}

export function createSocketController(store: Store): WebController {
  const socketUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  let socket: WebSocket | null = null;
  const send = (command: ClientCommand): void => {
    socket?.send(JSON.stringify(command));
  };

  const controller: AgentController = {
    submit: (text) => {
      send({ type: "submit", text });
    },
    cancel: () => {
      send({ type: "cancel" });
    },
    resolveApproval: (granted) => {
      send({ type: "approve", granted });
    },
    selectProvider: (providerName, modelId) => {
      send({ type: "select-provider", providerName, modelId });
    },
    saveApiKey: (providerName, apiKey) => {
      send({ type: "save-api-key", providerName, apiKey });
    },
    testConnection: (providerName) => {
      send({ type: "test-connection", providerName });
    },
    openKeyPage: (url) => {
      window.open(url, "_blank", "noopener");
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
}
