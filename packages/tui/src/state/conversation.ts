import { atom } from "jotai";
import type { AgentEvent } from "@totvibe/core";
import { agentStatusAtom, isStreamingAtom } from "./session";

export type Role = "user" | "assistant" | "tool";

export interface DisplayMessage {
  id: string;
  role: Role;
  text: string;
}

export const messagesAtom = atom<DisplayMessage[]>([]);

const messageIdCounterAtom = atom(0);

export const appendMessageAtom = atom(
  null,
  (get, set, message: { role: Role; text: string }) => {
    const id = get(messageIdCounterAtom) + 1;
    set(messageIdCounterAtom, id);
    set(messagesAtom, [...get(messagesAtom), { id: `m${id}`, ...message }]);
  },
);

export const applyEventAtom = atom(null, (get, set, event: AgentEvent) => {
  switch (event.type) {
    case "text": {
      const messages = get(messagesAtom);
      const last = messages.at(-1);
      if (last?.role === "assistant") {
        set(messagesAtom, [
          ...messages.slice(0, -1),
          { ...last, text: last.text + event.text },
        ]);
      } else {
        set(appendMessageAtom, { role: "assistant", text: event.text });
      }
      break;
    }
    case "tool_call":
      set(appendMessageAtom, {
        role: "tool",
        text: `⏺ ${event.name} ${formatToolInput(event.input)}`,
      });
      break;
    case "tool_error":
      set(appendMessageAtom, { role: "tool", text: `✗ ${event.name}: ${event.error}` });
      break;
    case "turn_end":
      set(isStreamingAtom, false);
      set(agentStatusAtom, `ready · ${event.finishReason}`);
      break;
    case "error":
      set(appendMessageAtom, { role: "tool", text: `error: ${event.error}` });
      set(isStreamingAtom, false);
      set(agentStatusAtom, "error");
      break;
    case "aborted":
      set(isStreamingAtom, false);
      set(agentStatusAtom, "aborted");
      break;
    case "turn_start":
    case "reasoning":
    case "tool_result":
    case "message":
      break;
  }
});

export function formatToolInput(input: unknown): string {
  let text: string;
  try {
    text = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    text = String(input);
  }
  return text.length > 96 ? `${text.slice(0, 95)}…` : text;
}
