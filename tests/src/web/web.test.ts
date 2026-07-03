import { vi } from 'vitest';

import { registerSharedScenarios } from '@/shared-stories';

import { webHarness } from './harness';

vi.mock('@totvibe/core/ai-core', async importOriginal => {
  const realAiCore = await importOriginal<typeof import('@totvibe/core/ai-core')>();
  const { streamScriptedReply } = await import('@/fixtures/model-mock');
  return { ...realAiCore, streamText: streamScriptedReply };
});

registerSharedScenarios(webHarness);
