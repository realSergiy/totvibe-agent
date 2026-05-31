import type { ModelMessage } from "./ai-core";

export interface Session {
  id: string;
  messages: ModelMessage[];
}

export function createSession(id: string = crypto.randomUUID(), messages: ModelMessage[] = []): Session {
  return { id, messages };
}
