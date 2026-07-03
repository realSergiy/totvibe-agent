import { test, vi } from 'vitest';

import { registerSharedScenarios } from '@/shared-stories';

import { tuiHarness } from './harness';

vi.mock('@totvibe/core/ai-core', async importOriginal => {
  const realAiCore = await importOriginal<typeof import('@totvibe/core/ai-core')>();
  const { streamScriptedReply } = await import('@/fixtures/model-mock');
  return { ...realAiCore, streamText: streamScriptedReply };
});

registerSharedScenarios(tuiHarness);

test('arrowing down moves the highlight to the next provider', async () => {
  const scene = await tuiHarness.unconnected();
  const expectShows = scene.assert.shows;
  expectShows('▶ ○ Alibaba Qwen');
  await scene.pressArrowDown();
  expectShows('▶ ○ Moonshot Kimi');
  await scene.dispose();
});
