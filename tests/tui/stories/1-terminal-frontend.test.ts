import { describe, test, vi } from 'vitest';

import {
  expectGrantCommandConfirmation,
  expectInputPromptWhenConnected,
  expectProviderCommandOpensDialog,
  expectProviderDialogWhenUnconnected,
  expectStreamedModelReply,
  tuiHarness,
} from '#tui';

vi.mock('@totvibe/core/ai-core', async importOriginal => {
  const realAiCore = await importOriginal<typeof import('@totvibe/core/ai-core')>();
  const { streamScriptedReply } = await import('#model-mock');
  return { ...realAiCore, streamText: streamScriptedReply };
});

describe('1.1 connecting a provider', () => {
  test('1.1.1 opens the provider dialog when no provider is connected', () =>
    expectProviderDialogWhenUnconnected(tuiHarness));

  test('1.1.2 arrowing down moves the highlight to the next provider', async () => {
    const scene = await tuiHarness.unconnected();
    const expectShows = scene.assert.shows;
    expectShows('▶ ○ Alibaba Qwen');
    await scene.pressArrowDown();
    expectShows('▶ ○ Moonshot Kimi');
    await scene.dispose();
  });

  test('1.1.3 shows the input prompt when a provider is connected', () => expectInputPromptWhenConnected(tuiHarness));
});

describe('1.2 driving the session with slash commands', () => {
  test('1.2.1 the /grant command prints a confirmation in the conversation', () =>
    expectGrantCommandConfirmation(tuiHarness));

  test('1.2.2 the /provider command opens the provider dialog', () => expectProviderCommandOpensDialog(tuiHarness));
});

describe('1.3 talking to the model', () => {
  test("1.3.1 sends a message and renders the model's streamed reply", () => expectStreamedModelReply(tuiHarness));
});
