import type { ModelMessage } from 'ai';

import { mkdtemp, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import type { AgentEvent } from '#core';

import { createSession, EventBus, findLatestSessionId, JsonlLog, loadSessionMessages, SessionStore } from '#core';

const MINUTE_MS = 60_000;

const scratchDir = () => mkdtemp(path.join(tmpdir(), 'totvibe-core-'));

describe('3.1 broadcasting agent events', () => {
  test('3.1.1 delivers events to every subscriber until it unsubscribes', () => {
    const bus = new EventBus();
    const first: AgentEvent[] = [];
    const second: AgentEvent[] = [];
    const unsubscribeFirst = bus.subscribe(event => {
      first.push(event);
    });
    bus.subscribe(event => {
      second.push(event);
    });
    bus.publish({ type: 'turn_start' });
    unsubscribeFirst();
    bus.publish({ finishReason: 'stop', type: 'turn_end' });
    expect(first).toEqual([{ type: 'turn_start' }]);
    expect(second).toEqual([{ type: 'turn_start' }, { finishReason: 'stop', type: 'turn_end' }]);
  });
});

describe('3.2 appending records to a jsonl log', () => {
  test('3.2.1 appends records in order and reads them back through a schema', async () => {
    const dir = await scratchDir();
    const log = new JsonlLog(path.join(dir, 'nested', 'log.jsonl'));
    log.append({ n: 1 });
    log.append({ n: 2 });
    await log.flushed();
    const CountRecordSchema = z.object({ n: z.number() });
    const records = await log.readAll(CountRecordSchema);
    expect(records).toEqual([{ n: 1 }, { n: 2 }]);
  });

  test('3.2.2 reads an absent log as an empty history', async () => {
    const dir = await scratchDir();
    const log = new JsonlLog(path.join(dir, 'missing.jsonl'));
    expect(await log.readAll(z.object({}))).toEqual([]);
  });
});

describe('3.3 persisting and resuming sessions', () => {
  test('3.3.1 persists only message events and loads them back', async () => {
    const dir = await scratchDir();
    const store = new SessionStore(dir, 's1');
    const message: ModelMessage = { content: 'hello', role: 'user' };
    store.persist({ message, type: 'message' });
    store.persist({ finishReason: 'stop', type: 'turn_end' });
    await store.flushed();
    expect(await loadSessionMessages(dir, 's1')).toEqual([message]);
  });

  test('3.3.2 finds the most recently modified session id', async () => {
    const dir = await scratchDir();
    const older = new SessionStore(dir, 'older');
    older.persist({ message: { content: 'a', role: 'user' }, type: 'message' });
    await older.flushed();
    const newer = new SessionStore(dir, 'newer');
    newer.persist({ message: { content: 'b', role: 'user' }, type: 'message' });
    await newer.flushed();
    const past = new Date(Date.now() - MINUTE_MS);
    await utimes(path.join(dir, 'older.jsonl'), past, past);
    expect(await findLatestSessionId(dir)).toBe('newer');
    expect(await findLatestSessionId(path.join(dir, 'nowhere'))).toBeUndefined();
  });

  test('3.3.3 creates sessions with a fresh id and empty history by default', () => {
    const session = createSession();
    expect(session.id).toMatch(/[0-9a-f-]{36}/);
    expect(session.messages).toEqual([]);
    const seeded = createSession('s9', [{ content: 'hi', role: 'user' }]);
    expect(seeded).toEqual({ id: 's9', messages: [{ content: 'hi', role: 'user' }] });
  });
});
