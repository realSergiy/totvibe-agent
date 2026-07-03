import type { AgentDeps, AgentEvent, ToolDef } from '@totvibe/core';

import { defineTool } from '@totvibe/core';
import { z } from 'zod';

export {
  abortedTurn,
  failingTurn,
  resetModelReply,
  scriptModelTurns,
  streamScriptedReply,
  textTurn,
  toolCallTurn,
} from '#model-mock';

export {
  type AgentDeps,
  type AgentEvent,
  buildModelToolSet,
  compose,
  createSession,
  EventBus,
  executeToolCall,
  findLatestSessionId,
  findToolDefinition,
  isReadOnly,
  JsonlLog,
  loadSessionMessages,
  type Middleware,
  passthrough,
  runAgent,
  runToolCalls,
  SessionStore,
  type ToolCallOutcome,
  type ToolCallRequest,
  type ToolContext,
  type ToolDef,
} from '@totvibe/core';

export const echoTool: ToolDef<{ text: string }> = defineTool({
  description: 'Echoes its input back.',
  execute: ({ text }) => Promise.resolve(`echo: ${text}`),
  inputSchema: z.object({ text: z.string() }),
  name: 'echo',
  risk: 'read',
});

export const failingTool: ToolDef<{ text: string }> = defineTool({
  description: 'Always fails.',
  execute: () => Promise.reject(new Error('tool exploded')),
  inputSchema: z.object({ text: z.string() }),
  name: 'explode',
  risk: 'read',
});

export const makeMutatingTool = (log: string[]): ToolDef<{ text: string }> =>
  defineTool({
    description: 'Records its input.',
    execute: ({ text }) => {
      log.push(text);
      return Promise.resolve(`recorded: ${text}`);
    },
    inputSchema: z.object({ text: z.string() }),
    name: 'record',
    risk: 'mutate',
  });

export const agentDeps = (overrides: Partial<AgentDeps> = {}): AgentDeps => ({
  cwd: '/tmp',
  model: 'scripted-model',
  system: 'fixture system prompt',
  tools: [echoTool],
  ...overrides,
});

export const collectEvents = async (events: AsyncGenerator<AgentEvent>) => {
  const collected: AgentEvent[] = await Array.fromAsync(events);
  return collected;
};

export const eventTypes = (events: AgentEvent[]) => events.map(event => event.type);
