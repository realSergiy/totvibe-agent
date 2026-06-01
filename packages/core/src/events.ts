import type { ModelMessage } from './ai-core';

export type AgentEvent =
  | { error: string; id: string; name: string; type: 'tool_error' }
  | { error: string; type: 'error' }
  | { finishReason: string; type: 'turn_end' }
  | { id: string; input: unknown; name: string; type: 'tool_call' }
  | { id: string; name: string; output: unknown; type: 'tool_result' }
  | { message: ModelMessage; type: 'message' }
  | { text: string; type: 'reasoning' }
  | { text: string; type: 'text' }
  | { type: 'aborted' }
  | { type: 'turn_start' };
