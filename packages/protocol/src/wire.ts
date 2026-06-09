import type { AgentEvent } from '@totvibe/core';
import type { ApprovalRequest } from '@totvibe/safety';
import type { SandboxStatus } from '@totvibe/sandbox';

import { modelMessageSchema } from 'ai';
import { z } from 'zod';

const toolRiskSchema = z.enum(['mutate', 'read']);

const agentEventSchema: z.ZodType<AgentEvent> = z.discriminatedUnion('type', [
  z.object({ error: z.string(), id: z.string(), name: z.string(), type: z.literal('tool_error') }),
  z.object({ error: z.string(), type: z.literal('error') }),
  z.object({ finishReason: z.string(), type: z.literal('turn_end') }),
  z.object({ id: z.string(), input: z.unknown(), name: z.string(), type: z.literal('tool_call') }),
  z.object({ id: z.string(), name: z.string(), output: z.unknown(), type: z.literal('tool_result') }),
  z.object({ message: modelMessageSchema, type: z.literal('message') }),
  z.object({ text: z.string(), type: z.literal('reasoning') }),
  z.object({ text: z.string(), type: z.literal('text') }),
  z.object({ type: z.literal('aborted') }),
  z.object({ type: z.literal('turn_start') }),
]);

const approvalRequestSchema: z.ZodType<ApprovalRequest> = z.object({
  command: z.string().optional(),
  input: z.unknown(),
  name: z.string(),
  risk: toolRiskSchema,
});

const sandboxStatusSchema: z.ZodType<SandboxStatus> = z.object({
  available: z.boolean(),
  degraded: z.boolean(),
  enabled: z.boolean(),
  hasLandlock: z.boolean(),
  net: z.enum(['inherit', 'none']),
});

export type ClientCommand =
  | { apiKey: string; providerName: string; type: 'save-api-key' }
  | { granted: boolean; type: 'approve' }
  | { modelId: string; providerName: string; type: 'select-provider' }
  | { providerName: string; type: 'test-connection' }
  | { text: string; type: 'submit' }
  | { type: 'cancel' };

export const clientCommandSchema: z.ZodType<ClientCommand> = z.discriminatedUnion('type', [
  z.object({ apiKey: z.string(), providerName: z.string(), type: z.literal('save-api-key') }),
  z.object({ granted: z.boolean(), type: z.literal('approve') }),
  z.object({ modelId: z.string(), providerName: z.string(), type: z.literal('select-provider') }),
  z.object({ providerName: z.string(), type: z.literal('test-connection') }),
  z.object({ text: z.string(), type: z.literal('submit') }),
  z.object({ type: z.literal('cancel') }),
]);

export type ConnectionStatus = 'checking' | 'no-key' | 'ok' | 'rejected' | 'unreachable';

export type Role = 'assistant' | 'tool' | 'user';

export type ServerEvent =
  | { event: AgentEvent; type: 'agent' }
  | { modelId: string; providerName: string; type: 'provider-changed' }
  | { names: string[]; type: 'connected-providers' }
  | { open: boolean; type: 'provider-dialog' }
  | { request?: ApprovalRequest; type: 'approval-request' }
  | { role: Role; text: string; type: 'message' }
  | { session: SessionInfo; type: 'init' }
  | { status: ConnectionStatus; type: 'connection-status' }
  | { status: SandboxStatus; type: 'sandbox-status' }
  | { status: string; type: 'agent-status' }
  | { streaming: boolean; type: 'streaming' }
  | { text: string; type: 'notice' };

export type SessionInfo = {
  cwd: string;
  isProviderDialogOpen: boolean;
  modelId: string;
  providerName: string;
};

const connectionStatusSchema = z.enum(['checking', 'no-key', 'ok', 'rejected', 'unreachable']);

const roleSchema = z.enum(['assistant', 'tool', 'user']);

const sessionInfoSchema: z.ZodType<SessionInfo> = z.object({
  cwd: z.string(),
  isProviderDialogOpen: z.boolean(),
  modelId: z.string(),
  providerName: z.string(),
});

export const serverEventSchema: z.ZodType<ServerEvent> = z.discriminatedUnion('type', [
  z.object({ event: agentEventSchema, type: z.literal('agent') }),
  z.object({ modelId: z.string(), providerName: z.string(), type: z.literal('provider-changed') }),
  z.object({ names: z.array(z.string()), type: z.literal('connected-providers') }),
  z.object({ open: z.boolean(), type: z.literal('provider-dialog') }),
  z.object({ request: approvalRequestSchema.optional(), type: z.literal('approval-request') }),
  z.object({ role: roleSchema, text: z.string(), type: z.literal('message') }),
  z.object({ session: sessionInfoSchema, type: z.literal('init') }),
  z.object({ status: connectionStatusSchema, type: z.literal('connection-status') }),
  z.object({ status: sandboxStatusSchema, type: z.literal('sandbox-status') }),
  z.object({ status: z.string(), type: z.literal('agent-status') }),
  z.object({ streaming: z.boolean(), type: z.literal('streaming') }),
  z.object({ text: z.string(), type: z.literal('notice') }),
]);
