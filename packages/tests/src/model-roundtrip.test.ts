import { test } from "bun:test";
import { arrange } from "./fixtures";

test("sends a message and renders the model's streamed reply", async () => {
  const scene = await arrange.connectedWithReply("pong from the model");
  await scene.act.typeAndSubmit("ping");
  await scene.assert.frameEventuallyShows("pong from the model");
  scene.assert.frameShows("ping");
  await scene.dispose();
});
