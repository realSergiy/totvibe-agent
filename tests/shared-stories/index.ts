import type { Harness } from './harness';

export const expectProviderDialogWhenUnconnected = async (harness: Harness) => {
  const scene = await harness.unconnected();
  scene.assert.shows('Connect a provider');
  scene.assert.shows('Alibaba Qwen');
  await scene.dispose();
};

export const expectInputPromptWhenConnected = async (harness: Harness) => {
  const scene = await harness.connected();
  scene.assert.shows('Ask totvibe to do something');
  await scene.dispose();
};

export const expectGrantCommandConfirmation = async (harness: Harness) => {
  const scene = await harness.connected();
  await scene.act.typeAndSubmit('/grant /tmp/demo');
  scene.assert.shows('granted read/write: /tmp/demo');
  await scene.dispose();
};

export const expectProviderCommandOpensDialog = async (harness: Harness) => {
  const scene = await harness.connected();
  await scene.act.typeAndSubmit('/provider');
  scene.assert.shows('Connect a provider');
  await scene.dispose();
};

export const expectStreamedModelReply = async (harness: Harness) => {
  const scene = await harness.connectedWithReply('pong from the model');
  await scene.act.typeAndSubmit('ping');
  await scene.assert.eventuallyShows('pong from the model');
  scene.assert.shows('ping');
  await scene.dispose();
};
