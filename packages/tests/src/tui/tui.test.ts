import { test } from "bun:test";

import { registerSharedScenarios } from "../sharedStories";
import { tuiHarness } from "./harness";

await registerSharedScenarios(tuiHarness);

test("arrowing down moves the highlight to the next provider", async () => {
  const scene = await tuiHarness.unconnected();
  scene.assert.shows("▶ ○ Alibaba Qwen");
  await scene.pressArrowDown();
  scene.assert.shows("▶ ○ Moonshot Kimi");
  await scene.dispose();
});
