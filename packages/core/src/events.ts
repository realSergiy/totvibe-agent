import type { ModelMessage } from "./ai-core";

export type AgentEvent =
  | { type: "turn_start" }
  | { type: "message"; message: ModelMessage }
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; output: unknown }
  | { type: "tool_error"; id: string; name: string; error: string }
  | { type: "turn_end"; finishReason: string }
  | { type: "error"; error: string }
  | { type: "aborted" };
