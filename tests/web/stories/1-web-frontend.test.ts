import { describe, test, vi } from 'vitest';

import {
  expectGrantCommandConfirmation,
  expectInputPromptWhenConnected,
  expectProviderCommandOpensDialog,
  expectProviderDialogWhenUnconnected,
  expectStreamedModelReply,
  webHarness,
} from '#web';

vi.mock('@totvibe/core/ai-core', async importOriginal => {
  const realAiCore = await importOriginal<typeof import('@totvibe/core/ai-core')>();
  const { streamScriptedReply } = await import('#model-mock');
  return { ...realAiCore, streamText: streamScriptedReply };
});

describe('1.1 connecting a provider', () => {
  test('1.1.1 opens the provider dialog when no provider is connected', () =>
    expectProviderDialogWhenUnconnected(webHarness));

  test('1.1.2 shows the input prompt when a provider is connected', () => expectInputPromptWhenConnected(webHarness));
});

describe('1.2 driving the session with slash commands', () => {
  test('1.2.1 the /grant command prints a confirmation in the conversation', () =>
    expectGrantCommandConfirmation(webHarness));

  test('1.2.2 the /provider command opens the provider dialog', () => expectProviderCommandOpensDialog(webHarness));
});

describe('1.3 talking to the model', () => {
  test("1.3.1 sends a message and renders the model's streamed reply", () => expectStreamedModelReply(webHarness));
});
