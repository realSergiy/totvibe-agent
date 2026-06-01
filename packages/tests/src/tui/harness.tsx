import { act } from "react";
import { expect } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { Root } from "@totvibe/tui/root";
import {
  buildConfig,
  CONNECTED_PROVIDER_KEYS,
  isolateProviderEnv,
  stubFetchOk,
} from "../fixtures/config";
import { resetModelReply, setModelReply } from "../fixtures/model-mock";
import type { Scene } from "../sharedStories/harness";

type RenderSetup = Awaited<ReturnType<typeof testRender>>;

interface RenderOptions {
  connectedProviderKeys?: Record<string, string>;
}

export interface TuiScene extends Scene {
  pressArrowDown(): Promise<void>;
}

async function renderScene(options: RenderOptions): Promise<TuiScene> {
  const restoreEnv = isolateProviderEnv(options.connectedProviderKeys ?? {});
  const restoreFetch = stubFetchOk();
  let setup!: RenderSetup;
  await act(async () => {
    setup = await testRender(<Root config={buildConfig()} />, {
      width: 120,
      height: 40,
      exitOnCtrlC: false,
    });
    await setup.waitForVisualIdle();
  });

  const settle = async (interact: () => void | Promise<void>) => {
    await act(async () => {
      await interact();
    });
    await setup.flush();
  };

  const frameShows = (text: string) => {
    expect(setup.captureCharFrame()).toContain(text);
  };

  return {
    act: {
      type: (text) => settle(() => setup.mockInput.typeText(text)),
      typeAndSubmit: (text) =>
        settle(async () => {
          await setup.mockInput.typeText(text);
          setup.mockInput.pressEnter();
        }),
    },
    assert: {
      shows: frameShows,
      hides(text) {
        expect(setup.captureCharFrame()).not.toContain(text);
      },
      async eventuallyShows(text) {
        await act(async () => {
          for (let pass = 0; pass < 50; pass += 1) {
            await setup.flush();
            if (setup.captureCharFrame().includes(text)) return;
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
        });
        frameShows(text);
      },
    },
    pressArrowDown: () =>
      settle(() => {
        setup.mockInput.pressArrow("down");
      }),
    async dispose() {
      await act(async () => {
        await setup.flush();
        setup.renderer.destroy();
      });
      restoreFetch();
      restoreEnv();
    },
  };
}

export const tuiHarness = {
  unconnected(): Promise<TuiScene> {
    resetModelReply();
    return renderScene({});
  },
  connected(): Promise<TuiScene> {
    resetModelReply();
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
  connectedWithReply(reply: string): Promise<TuiScene> {
    setModelReply(reply);
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
};
