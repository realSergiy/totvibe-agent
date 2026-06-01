import { createContext, useContext } from "react";

export interface AgentController {
  submit(text: string): void;
  cancel(): void;
  resolveApproval(granted: boolean): void;
  selectProvider(providerName: string, modelId: string): void;
  saveApiKey(providerName: string, apiKey: string): void;
  testConnection(providerName: string): void;
  openKeyPage(url: string): void;
}

export const ControllerContext = createContext<AgentController | null>(null);

export function useController(): AgentController {
  const controller = useContext(ControllerContext);
  if (!controller) {
    throw new Error("useController must be used within a ControllerContext provider");
  }
  return controller;
}
