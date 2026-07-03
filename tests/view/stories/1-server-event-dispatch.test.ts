import { describe, expect, test } from 'vitest';

import type { SessionInfo } from '#view';

import {
  agentStatusAtom,
  applyServerEvent,
  connectedProvidersAtom,
  connectionStatusAtom,
  cwdAtom,
  DEFAULT_PROVIDER,
  makeStore,
  messagesAtom,
  modelIdAtom,
  noticeAtom,
  pendingApprovalAtom,
  providerAtom,
  providerDialogOpenAtom,
  providerNameAtom,
  sandboxStatusAtom,
  streamingAtom,
} from '#view';

const session: SessionInfo = {
  cwd: '~/project',
  isProviderDialogOpen: false,
  modelId: 'qwen3.7-max',
  providerName: 'qwen',
};

describe('1.1 rendering agent events into the conversation', () => {
  test('1.1.1 streams assistant text into one growing message', () => {
    const store = makeStore();
    applyServerEvent(store, { event: { text: 'Hello', type: 'text' }, type: 'agent' });
    applyServerEvent(store, { event: { text: ' world', type: 'text' }, type: 'agent' });
    expect(store.get(messagesAtom).map(message => message.text)).toEqual(['Hello world']);
    applyServerEvent(store, { role: 'user', text: 'thanks', type: 'message' });
    applyServerEvent(store, { event: { text: 'Anytime', type: 'text' }, type: 'agent' });
    expect(store.get(messagesAtom).map(message => message.text)).toEqual(['Hello world', 'thanks', 'Anytime']);
  });

  test('1.1.2 records a tool call with a preview of its input', () => {
    const store = makeStore();
    applyServerEvent(store, {
      event: { id: 't1', input: { path: 'notes.txt' }, name: 'read_file', type: 'tool_call' },
      type: 'agent',
    });
    expect(store.get(messagesAtom)[0]).toMatchObject({ role: 'tool', text: '⏺ read_file {"path":"notes.txt"}' });
  });

  test('1.1.3 records a tool error against the tool name', () => {
    const store = makeStore();
    applyServerEvent(store, {
      event: { error: 'No such file: ghost.txt', id: 't1', name: 'read_file', type: 'tool_error' },
      type: 'agent',
    });
    expect(store.get(messagesAtom)[0]?.text).toBe('✗ read_file: No such file: ghost.txt');
  });

  test('1.1.4 ends the turn by stopping the stream and reporting the finish reason', () => {
    const store = makeStore();
    applyServerEvent(store, { streaming: true, type: 'streaming' });
    applyServerEvent(store, { event: { finishReason: 'stop', type: 'turn_end' }, type: 'agent' });
    expect(store.get(streamingAtom)).toBe(false);
    expect(store.get(agentStatusAtom)).toBe('ready · stop');
  });

  test('1.1.5 surfaces aborts and errors in the status line', () => {
    const store = makeStore();
    applyServerEvent(store, { event: { type: 'aborted' }, type: 'agent' });
    expect(store.get(agentStatusAtom)).toBe('aborted');
    applyServerEvent(store, { event: { error: 'boom', type: 'error' }, type: 'agent' });
    expect(store.get(agentStatusAtom)).toBe('error');
    expect(store.get(messagesAtom).at(-1)?.text).toBe('error: boom');
  });

  test('1.1.6 leaves the conversation untouched for bookkeeping events', () => {
    const store = makeStore();
    applyServerEvent(store, { event: { type: 'turn_start' }, type: 'agent' });
    applyServerEvent(store, { event: { text: 'thinking', type: 'reasoning' }, type: 'agent' });
    applyServerEvent(store, {
      event: { id: 't1', name: 'read_file', output: 'x', type: 'tool_result' },
      type: 'agent',
    });
    applyServerEvent(store, { event: { message: { content: 'hi', role: 'user' }, type: 'message' }, type: 'agent' });
    expect(store.get(messagesAtom)).toEqual([]);
  });
});

describe('1.2 tracking the session lifecycle', () => {
  test('1.2.1 init resets the conversation and seeds the session fields', () => {
    const store = makeStore();
    applyServerEvent(store, { role: 'tool', text: 'stale', type: 'message' });
    applyServerEvent(store, { session, type: 'init' });
    expect(store.get(messagesAtom)).toEqual([]);
    expect(store.get(cwdAtom)).toBe('~/project');
    expect(store.get(providerNameAtom)).toBe('qwen');
    expect(store.get(modelIdAtom)).toBe('qwen3.7-max');
    expect(store.get(agentStatusAtom)).toBe('ready');
    expect(store.get(providerDialogOpenAtom)).toBe(false);
  });

  test('1.2.2 appends role-tagged messages with unique ids', () => {
    const store = makeStore();
    applyServerEvent(store, { role: 'user', text: 'one', type: 'message' });
    applyServerEvent(store, { role: 'tool', text: 'two', type: 'message' });
    const messages = store.get(messagesAtom);
    expect(messages.map(message => message.role)).toEqual(['user', 'tool']);
    expect(new Set(messages.map(message => message.id)).size).toBe(messages.length);
  });

  test('1.2.3 tracks notices, streaming, status, approvals, and the sandbox', () => {
    const store = makeStore();
    applyServerEvent(store, { text: 'Saved key', type: 'notice' });
    applyServerEvent(store, { streaming: true, type: 'streaming' });
    applyServerEvent(store, { status: 'thinking…', type: 'agent-status' });
    const request = { input: {}, name: 'run_bash', risk: 'mutate' as const };
    applyServerEvent(store, { request, type: 'approval-request' });
    const sandboxStatus = { available: true, degraded: false, enabled: true, hasLandlock: true, net: 'none' as const };
    applyServerEvent(store, { status: sandboxStatus, type: 'sandbox-status' });
    expect(store.get(noticeAtom)).toBe('Saved key');
    expect(store.get(streamingAtom)).toBe(true);
    expect(store.get(agentStatusAtom)).toBe('thinking…');
    expect(store.get(pendingApprovalAtom)).toEqual(request);
    expect(store.get(sandboxStatusAtom)).toEqual(sandboxStatus);
    applyServerEvent(store, { type: 'approval-request' });
    expect(store.get(pendingApprovalAtom)).toBeUndefined();
  });
});

describe('1.3 tracking providers and connections', () => {
  test('1.3.1 switches the active provider and model', () => {
    const store = makeStore();
    applyServerEvent(store, { modelId: 'kimi-k2.6', providerName: 'kimi', type: 'provider-changed' });
    expect(store.get(providerNameAtom)).toBe('kimi');
    expect(store.get(modelIdAtom)).toBe('kimi-k2.6');
    expect(store.get(providerAtom).label).toBe('Moonshot Kimi');
  });

  test('1.3.2 falls back to the default provider for an unknown name', () => {
    const store = makeStore();
    applyServerEvent(store, { modelId: 'x', providerName: 'nonexistent', type: 'provider-changed' });
    expect(store.get(providerAtom)).toBe(DEFAULT_PROVIDER);
  });

  test('1.3.3 tracks the connected provider set, connection status, and dialog', () => {
    const store = makeStore();
    applyServerEvent(store, { names: ['qwen', 'kimi'], type: 'connected-providers' });
    applyServerEvent(store, { status: 'rejected', type: 'connection-status' });
    applyServerEvent(store, { open: true, type: 'provider-dialog' });
    expect(store.get(connectedProvidersAtom)).toEqual(new Set(['kimi', 'qwen']));
    expect(store.get(connectionStatusAtom)).toBe('rejected');
    expect(store.get(providerDialogOpenAtom)).toBe(true);
  });
});
