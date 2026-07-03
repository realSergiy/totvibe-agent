import type { AgentEvent } from '@totvibe/core';
import type { ApprovalRequest } from '@totvibe/safety';
import type { SandboxStatus } from '@totvibe/sandbox';

import { modelMessageSchema } from 'ai';
import { z } from 'zod';

const ToolRiskSchema = z.enum(['mutate', 'read']);

const AgentEventSchema = z.discriminatedUnion('type', [
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
]) satisfies z.ZodType<AgentEvent>;

const ApprovalRequestSchema = z.object({
  command: z.string().optional(),
  input: z.unknown(),
  name: z.string(),
  risk: ToolRiskSchema,
}) satisfies z.ZodType<ApprovalRequest>;

const SandboxStatusSchema = z.object({
  available: z.boolean(),
  degraded: z.boolean(),
  enabled: z.boolean(),
  hasLandlock: z.boolean(),
  net: z.enum(['inherit', 'none']),
}) satisfies z.ZodType<SandboxStatus>;

export type ClientCommand =
  | { apiKey: string; providerName: string; type: 'save-api-key' }
  | { granted: boolean; type: 'approve' }
  | { modelId: string; providerName: string; type: 'select-provider' }
  | { providerName: string; type: 'test-connection' }
  | { text: string; type: 'submit' }
  | { type: 'cancel' };

export const ClientCommandSchema = z.discriminatedUnion('type', [
  z.object({ apiKey: z.string(), providerName: z.string(), type: z.literal('save-api-key') }),
  z.object({ granted: z.boolean(), type: z.literal('approve') }),
  z.object({ modelId: z.string(), providerName: z.string(), type: z.literal('select-provider') }),
  z.object({ providerName: z.string(), type: z.literal('test-connection') }),
  z.object({ text: z.string(), type: z.literal('submit') }),
  z.object({ type: z.literal('cancel') }),
]) satisfies z.ZodType<ClientCommand>;

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

const ConnectionStatusSchema = z.enum(['checking', 'no-key', 'ok', 'rejected', 'unreachable']);

const ProviderNamesSchema = z.array(z.string());

const RoleSchema = z.enum(['assistant', 'tool', 'user']);

const SessionInfoSchema = z.object({
  cwd: z.string(),
  isProviderDialogOpen: z.boolean(),
  modelId: z.string(),
  providerName: z.string(),
}) satisfies z.ZodType<SessionInfo>;

export const ServerEventSchema = z.discriminatedUnion('type', [
  z.object({ event: AgentEventSchema, type: z.literal('agent') }),
  z.object({ modelId: z.string(), providerName: z.string(), type: z.literal('provider-changed') }),
  z.object({ names: ProviderNamesSchema, type: z.literal('connected-providers') }),
  z.object({ open: z.boolean(), type: z.literal('provider-dialog') }),
  z.object({ request: ApprovalRequestSchema.optional(), type: z.literal('approval-request') }),
  z.object({ role: RoleSchema, text: z.string(), type: z.literal('message') }),
  z.object({ session: SessionInfoSchema, type: z.literal('init') }),
  z.object({ status: ConnectionStatusSchema, type: z.literal('connection-status') }),
  z.object({ status: SandboxStatusSchema, type: z.literal('sandbox-status') }),
  z.object({ status: z.string(), type: z.literal('agent-status') }),
  z.object({ streaming: z.boolean(), type: z.literal('streaming') }),
  z.object({ text: z.string(), type: z.literal('notice') }),
]) satisfies z.ZodType<ServerEvent>;
