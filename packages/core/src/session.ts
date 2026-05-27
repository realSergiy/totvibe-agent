import type { ModelMessage } from "ai";

export interface Session {
  id: string;
  messages: ModelMessage[];
}

export function createSession(id: string = crypto.randomUUID()): Session {
  return { id, messages: [] };
}

export function cloneSession(session: Session): Session {
  return { id: crypto.randomUUID(), messages: structuredClone(session.messages) };
}
