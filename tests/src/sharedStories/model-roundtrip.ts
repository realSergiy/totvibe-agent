import { test } from 'bun:test';

import type { Harness } from './harness';

const registerModelRoundtripScenarios = (harness: Harness) => {
  test("sends a message and renders the model's streamed reply", async () => {
    const scene = await harness.connectedWithReply('pong from the model');
    await scene.act.typeAndSubmit('ping');
    await scene.assert.eventuallyShows('pong from the model');
    scene.assert.shows('ping');
    await scene.dispose();
  });
};

export default registerModelRoundtripScenarios;
