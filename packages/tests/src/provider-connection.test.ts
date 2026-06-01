import { test } from "bun:test";
import { arrange } from "./fixtures";

test("opens the provider dialog when no provider is connected", async () => {
  const scene = await arrange.unconnected();
  scene.assert.frameShows("Connect a provider");
  scene.assert.frameShows("Alibaba Qwen");
  await scene.dispose();
});

test("arrowing down moves the highlight to the next provider", async () => {
  const scene = await arrange.unconnected();
  scene.assert.frameShows("▶ ○ Alibaba Qwen");
  await scene.act.pressArrowDown();
  scene.assert.frameShows("▶ ○ Moonshot Kimi");
  await scene.dispose();
});
