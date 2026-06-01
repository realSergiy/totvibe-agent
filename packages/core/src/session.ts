import type { ModelMessage } from "./ai-core";

export type Session = {
  id: string;
  messages: ModelMessage[];
}

export const createSession = (id: string = crypto.randomUUID(), messages: ModelMessage[] = []) => ({ id, messages });
