import { test } from 'bun:test';

import type { Harness } from './harness';

const registerProviderConnectionScenarios = (harness: Harness) => {
  test('opens the provider dialog when no provider is connected', async () => {
    const scene = await harness.unconnected();
    scene.assert.shows('Connect a provider');
    scene.assert.shows('Alibaba Qwen');
    await scene.dispose();
  });
};

export default registerProviderConnectionScenarios;
