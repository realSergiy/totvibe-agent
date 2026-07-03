import { describe, expect, test } from 'vitest';

import {
  type ClientCommand,
  ClientCommandSchema,
  DEFAULT_PROVIDER,
  findProvider,
  PROVIDERS,
  type ServerEvent,
  ServerEventSchema,
} from '#protocol';

const roundTrip = <T>(value: T): T => structuredClone(value);

const CLIENT_COMMANDS: ClientCommand[] = [
  { text: 'ping', type: 'submit' },
  { type: 'cancel' },
  { granted: true, type: 'approve' },
  { modelId: 'qwen3.7-max', providerName: 'qwen', type: 'select-provider' },
  { apiKey: 'secret', providerName: 'qwen', type: 'save-api-key' },
  { providerName: 'qwen', type: 'test-connection' },
];

const SERVER_EVENTS: ServerEvent[] = [
  {
    session: { cwd: '~/project', isProviderDialogOpen: false, modelId: 'qwen3.7-max', providerName: 'qwen' },
    type: 'init',
  },
  { names: ['qwen', 'deepseek'], type: 'connected-providers' },
  { event: { text: 'hello', type: 'text' }, type: 'agent' },
  { type: 'approval-request' },
  { status: 'thinking…', type: 'agent-status' },
  { streaming: true, type: 'streaming' },
  { status: 'ok', type: 'connection-status' },
  { modelId: 'qwen3.7-max', providerName: 'qwen', type: 'provider-changed' },
  { open: true, type: 'provider-dialog' },
  { text: 'Saved DASHSCOPE_API_KEY to .env', type: 'notice' },
  { role: 'tool', text: 'granted read/write: /tmp/demo', type: 'message' },
  {
    status: { available: true, degraded: false, enabled: true, hasLandlock: true, net: 'none' },
    type: 'sandbox-status',
  },
];

describe('1.1 client commands on the wire', () => {
  test('1.1.1 every client command survives a JSON wire round-trip', () => {
    for (const command of CLIENT_COMMANDS) {
      expect(roundTrip(command)).toEqual(command);
    }
  });

  test('1.1.2 the client command schema accepts every command shape', () => {
    for (const command of CLIENT_COMMANDS) {
      expect(ClientCommandSchema.parse(roundTrip(command))).toEqual(command);
    }
  });

  test('1.1.3 the client command schema rejects an unknown command type', () => {
    expect(() => ClientCommandSchema.parse({ type: 'self-destruct' })).toThrow();
  });
});

describe('1.2 server events on the wire', () => {
  test('1.2.1 every server event survives a JSON wire round-trip', () => {
    for (const event of SERVER_EVENTS) {
      expect(roundTrip(event)).toEqual(event);
    }
  });

  test('1.2.2 the server event schema accepts every event shape', () => {
    for (const event of SERVER_EVENTS) {
      expect(ServerEventSchema.parse(roundTrip(event))).toEqual(event);
    }
  });

  test('1.2.3 the server event schema rejects a malformed event', () => {
    expect(() => ServerEventSchema.parse({ status: 42, type: 'agent-status' })).toThrow();
  });
});

describe('1.3 provider registry', () => {
  test('1.3.1 finds every registered provider by name', () => {
    for (const provider of PROVIDERS) {
      expect(findProvider(provider.name)).toBe(provider);
    }
  });

  test('1.3.2 returns undefined for an unknown provider name', () => {
    expect(findProvider('nonexistent')).toBeUndefined();
  });

  test('1.3.3 lists the default provider first with unique names and key env vars', () => {
    expect(PROVIDERS[0]).toBe(DEFAULT_PROVIDER);
    expect(new Set(PROVIDERS.map(provider => provider.name)).size).toBe(PROVIDERS.length);
    expect(new Set(PROVIDERS.map(provider => provider.apiKeyEnv)).size).toBe(PROVIDERS.length);
  });
});
