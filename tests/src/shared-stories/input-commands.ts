import { test } from 'vitest';

import type { Harness } from './harness';

const registerInputCommandScenarios = (harness: Harness) => {
  test('shows the input prompt when a provider is connected', async () => {
    const scene = await harness.connected();
    scene.assert.shows('Ask totvibe to do something');
    await scene.dispose();
  });

  test('the /grant command prints a confirmation in the conversation', async () => {
    const scene = await harness.connected();
    await scene.act.typeAndSubmit('/grant /tmp/demo');
    scene.assert.shows('granted read/write: /tmp/demo');
    await scene.dispose();
  });

  test('the /provider command opens the provider dialog', async () => {
    const scene = await harness.connected();
    await scene.act.typeAndSubmit('/provider');
    scene.assert.shows('Connect a provider');
    await scene.dispose();
  });
};

export default registerInputCommandScenarios;
