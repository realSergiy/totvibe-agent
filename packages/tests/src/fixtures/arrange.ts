import { renderWorld, type World } from "./world";
import { createAct, type Act } from "./act";
import { createAssert, type Assert } from "./assert";
import { resetModelReply, setModelReply } from "./model-mock";

const CONNECTED_PROVIDER_KEYS = { DASHSCOPE_API_KEY: "fixture-key-qwen" };

export interface Scene {
  act: Act;
  assert: Assert;
  dispose: () => Promise<void>;
}

function sceneFrom(world: World): Scene {
  return {
    act: createAct(world),
    assert: createAssert(world),
    dispose: () => world.dispose(),
  };
}

export const arrange = {
  async unconnected(): Promise<Scene> {
    resetModelReply();
    return sceneFrom(await renderWorld());
  },

  async connected(): Promise<Scene> {
    resetModelReply();
    return sceneFrom(await renderWorld({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS }));
  },

  async connectedWithReply(reply: string): Promise<Scene> {
    setModelReply(reply);
    return sceneFrom(await renderWorld({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS }));
  },
};
