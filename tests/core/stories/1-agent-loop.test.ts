import { describe, expect, test, vi } from 'vitest';

import {
  abortedTurn,
  agentDeps,
  collectEvents,
  createSession,
  eventTypes,
  failingTurn,
  runAgent,
  scriptModelTurns,
  textTurn,
  toolCallTurn,
} from '#core';

vi.mock('@totvibe/core/ai-core', async importOriginal => {
  const realAiCore = await importOriginal<typeof import('@totvibe/core/ai-core')>();
  const { streamScriptedReply } = await import('#model-mock');
  return { ...realAiCore, streamText: streamScriptedReply };
});

const echoCall = { input: { text: 'hi' }, toolCallId: 'call-1', toolName: 'echo' };

describe('1.1 streaming a plain reply', () => {
  test('1.1.1 yields the user message, streamed text, and turn end', async () => {
    scriptModelTurns(textTurn('pong'));
    const session = createSession('s1');
    const events = await collectEvents(runAgent(session, 'ping', agentDeps()));
    expect(eventTypes(events)).toEqual(['message', 'turn_start', 'text', 'message', 'turn_end']);
    expect(events.find(event => event.type === 'text')).toEqual({ text: 'pong', type: 'text' });
    expect(session.messages).toEqual([
      { content: 'ping', role: 'user' },
      { content: 'pong', role: 'assistant' },
    ]);
  });

  test('1.1.2 relays reasoning deltas as reasoning events', async () => {
    scriptModelTurns(
      textTurn('done', {
        parts: [
          { text: 'thinking hard', type: 'reasoning-delta' },
          { text: 'done', type: 'text-delta' },
        ],
      }),
    );
    const events = await collectEvents(runAgent(createSession(), 'go', agentDeps()));
    expect(events).toContainEqual({ text: 'thinking hard', type: 'reasoning' });
  });
});

describe('1.2 executing tool calls between turns', () => {
  test('1.2.1 runs the requested tool and feeds the result into the next turn', async () => {
    scriptModelTurns(toolCallTurn([echoCall]), textTurn('all done'));
    const session = createSession();
    const events = await collectEvents(runAgent(session, 'use the tool', agentDeps()));
    expect(events).toContainEqual({ id: 'call-1', input: { text: 'hi' }, name: 'echo', type: 'tool_call' });
    expect(events).toContainEqual({ id: 'call-1', name: 'echo', output: 'echo: hi', type: 'tool_result' });
    expect(events.at(-1)).toEqual({ finishReason: 'stop', type: 'turn_end' });
    const toolMessage = session.messages.find(message => message.role === 'tool');
    expect(toolMessage?.content).toEqual([
      { output: { type: 'text', value: 'echo: hi' }, toolCallId: 'call-1', toolName: 'echo', type: 'tool-result' },
    ]);
  });

  test('1.2.2 reports a call to an unknown tool as a tool error', async () => {
    scriptModelTurns(toolCallTurn([{ input: {}, toolCallId: 'call-9', toolName: 'teleport' }]), textTurn('sorry'));
    const events = await collectEvents(runAgent(createSession(), 'try it', agentDeps()));
    const toolError = events.find(event => event.type === 'tool_error');
    if (toolError?.type !== 'tool_error') throw new Error('expected a tool_error event');
    expect(toolError.error).toContain('Unknown tool "teleport"');
  });
});

describe('1.3 surviving model failures', () => {
  test('1.3.1 emits an error event when the model fails and no fallback exists', async () => {
    scriptModelTurns(failingTurn(new Error('rate limited')));
    const events = await collectEvents(runAgent(createSession(), 'hello', agentDeps()));
    expect(events.at(-1)).toEqual({ error: 'rate limited', type: 'error' });
  });

  test('1.3.2 retries the turn on the fallback model when the primary fails', async () => {
    scriptModelTurns(failingTurn(new Error('primary down')), textTurn('fallback says hi'));
    const events = await collectEvents(
      runAgent(createSession(), 'hello', agentDeps({ fallbackModel: 'fallback-model' })),
    );
    expect(events).toContainEqual({ text: 'fallback says hi', type: 'text' });
    expect(events.at(-1)).toEqual({ finishReason: 'stop', type: 'turn_end' });
  });

  test('1.3.3 emits an error event when the fallback model also fails', async () => {
    scriptModelTurns(failingTurn(new Error('primary down')), failingTurn(new Error('fallback down')));
    const events = await collectEvents(
      runAgent(createSession(), 'hello', agentDeps({ fallbackModel: 'fallback-model' })),
    );
    expect(events.at(-1)).toEqual({ error: 'fallback down', type: 'error' });
  });
});

describe('1.4 enforcing limits and cancellation', () => {
  test('1.4.1 stops with max_steps when the model keeps calling tools', async () => {
    scriptModelTurns(toolCallTurn([echoCall]), toolCallTurn([echoCall]), textTurn('never reached'));
    const events = await collectEvents(runAgent(createSession(), 'loop', agentDeps({ maxSteps: 2 })));
    expect(events.at(-1)).toEqual({ finishReason: 'max_steps', type: 'turn_end' });
  });

  test('1.4.2 stops with token_budget once usage exceeds the budget', async () => {
    scriptModelTurns(
      toolCallTurn([echoCall], { usage: { inputTokens: 400, outputTokens: 200 } }),
      textTurn('never reached'),
    );
    const events = await collectEvents(runAgent(createSession(), 'spend', agentDeps({ tokenBudget: 500 })));
    expect(events.at(-1)).toEqual({ finishReason: 'token_budget', type: 'turn_end' });
  });

  test('1.4.3 stops with wall_clock once the deadline passes', async () => {
    scriptModelTurns(toolCallTurn([echoCall]), textTurn('never reached'));
    const events = await collectEvents(runAgent(createSession(), 'slow', agentDeps({ wallClockMs: -1 })));
    expect(events.at(-1)).toEqual({ finishReason: 'wall_clock', type: 'turn_end' });
  });

  test('1.4.4 yields aborted when the signal is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    scriptModelTurns(textTurn('never reached'));
    const events = await collectEvents(runAgent(createSession(), 'stop', agentDeps({ signal: controller.signal })));
    expect(events.at(-1)).toEqual({ type: 'aborted' });
  });

  test('1.4.5 yields aborted when the stream reports an abort mid-turn', async () => {
    scriptModelTurns(abortedTurn());
    const events = await collectEvents(runAgent(createSession(), 'stop', agentDeps()));
    expect(events.at(-1)).toEqual({ type: 'aborted' });
  });
});
