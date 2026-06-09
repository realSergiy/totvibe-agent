import type { ClientCommand, ServerEvent } from '@totvibe/protocol';

import { expect, test } from 'bun:test';

const roundTrip = <T>(value: T): T => structuredClone(value);

test('client commands survive a JSON wire round-trip', () => {
  const commands: ClientCommand[] = [
    { text: 'ping', type: 'submit' },
    { type: 'cancel' },
    { granted: true, type: 'approve' },
    { modelId: 'qwen3.7-max', providerName: 'qwen', type: 'select-provider' },
    { apiKey: 'secret', providerName: 'qwen', type: 'save-api-key' },
    { providerName: 'qwen', type: 'test-connection' },
  ];
  for (const command of commands) {
    expect(roundTrip(command)).toEqual(command);
  }
});

test('server events survive a JSON wire round-trip', () => {
  const events: ServerEvent[] = [
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
  ];
  for (const event of events) {
    expect(roundTrip(event)).toEqual(event);
  }
});
