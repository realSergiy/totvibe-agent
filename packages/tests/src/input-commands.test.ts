import { test } from "bun:test";
import { arrange } from "./fixtures";

test("shows the input prompt when a provider is connected", async () => {
  const scene = await arrange.connected();
  scene.assert.frameShows("Ask totvibe to do something");
  await scene.dispose();
});

test("the /grant command prints a confirmation in the conversation", async () => {
  const scene = await arrange.connected();
  await scene.act.typeAndSubmit("/grant /tmp/demo");
  scene.assert.frameShows("granted read/write: /tmp/demo");
  await scene.dispose();
});

test("the /provider command opens the provider dialog", async () => {
  const scene = await arrange.connected();
  await scene.act.typeAndSubmit("/provider");
  scene.assert.frameShows("Connect a provider");
  await scene.dispose();
});
