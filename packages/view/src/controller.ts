import { createContext, useContext } from "react";

export type AgentController = {
  cancel(): void;
  openKeyPage(url: string): void;
  resolveApproval(granted: boolean): void;
  saveApiKey(providerName: string, apiKey: string): void;
  selectProvider(providerName: string, modelId: string): void;
  submit(text: string): void;
  testConnection(providerName: string): void;
}

export const ControllerContext = createContext<AgentController | null>(null);

export const useController = () => {
  const controller = useContext(ControllerContext);
  if (!controller) {
    throw new Error("useController must be used within a ControllerContext provider");
  }
  return controller;
};
