import type { AgentEvent } from "@totvibe/core";
import type { ApprovalRequest } from "@totvibe/safety";

export type Role = "user" | "assistant" | "tool";

export interface DisplayMessage {
  id: string;
  role: Role;
  text: string;
}

export interface AppState {
  messages: DisplayMessage[];
  streaming: boolean;
  pendingApproval: ApprovalRequest | null;
  status: string;
}

export type Action =
  | { type: "user_message"; text: string }
  | { type: "agent_event"; event: AgentEvent }
  | { type: "approval_request"; request: ApprovalRequest }
  | { type: "approval_resolved" }
  | { type: "notice"; text: string };

export const initialState: AppState = {
  messages: [],
  streaming: false,
  pendingApproval: null,
  status: "ready",
};

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "user_message":
      return {
        ...state,
        streaming: true,
        status: "thinking…",
        messages: [...state.messages, { id: nextMessageId(), role: "user", text: action.text }],
      };
    case "agent_event":
      return applyEvent(state, action.event);
    case "approval_request":
      return { ...state, pendingApproval: action.request, status: "approval required" };
    case "approval_resolved":
      return { ...state, pendingApproval: null, status: "thinking…" };
    case "notice":
      return pushMessage(state, "tool", action.text);
  }
}

function applyEvent(state: AppState, event: AgentEvent): AppState {
  switch (event.type) {
    case "text":
      return appendAssistantText(state, event.text);
    case "tool_call":
      return pushMessage(state, "tool", `⏺ ${event.name} ${formatInput(event.input)}`);
    case "tool_error":
      return pushMessage(state, "tool", `✗ ${event.name}: ${event.error}`);
    case "turn_end":
      return { ...state, streaming: false, status: `ready · ${event.finishReason}` };
    case "error":
      return { ...pushMessage(state, "tool", `error: ${event.error}`), streaming: false, status: "error" };
    case "aborted":
      return { ...state, streaming: false, status: "aborted" };
    case "turn_start":
    case "reasoning":
    case "tool_result":
    case "message":
      return state;
  }
}

function pushMessage(state: AppState, role: Role, text: string): AppState {
  return { ...state, messages: [...state.messages, { id: nextMessageId(), role, text }] };
}

function appendAssistantText(state: AppState, delta: string): AppState {
  const last = state.messages.at(-1);
  if (last && last.role === "assistant") {
    const updated: DisplayMessage = { ...last, text: last.text + delta };
    return { ...state, messages: [...state.messages.slice(0, -1), updated] };
  }
  return pushMessage(state, "assistant", delta);
}

export function formatInput(input: unknown): string {
  let text: string;
  try {
    text = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    text = String(input);
  }
  return text.length > 96 ? `${text.slice(0, 95)}…` : text;
}
