import { createContext, useContext } from "react";
import type { AgentController } from "./controller";

export const ControllerContext = createContext<AgentController | null>(null);

export function useController(): AgentController {
  const controller = useContext(ControllerContext);
  if (!controller) {
    throw new Error("useController must be used within a ControllerContext provider");
  }
  return controller;
}
