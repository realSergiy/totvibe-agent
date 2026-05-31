import { createContext, useContext, type ReactNode } from "react";
import type { AgentController } from "./controller";

const ControllerContext = createContext<AgentController | null>(null);

export function ControllerProvider({
  controller,
  children,
}: {
  controller: AgentController;
  children: ReactNode;
}) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>;
}

export function useController(): AgentController {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error("useController must be used within ControllerProvider");
  return controller;
}
