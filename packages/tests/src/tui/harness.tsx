import { testRender } from "@opentui/react/test-utils";
import { Root } from "@totvibe/tui/root";
import { expect } from "bun:test";
import { act } from "react";

import type { Scene } from "../sharedStories/harness";

import {
  buildConfig,
  CONNECTED_PROVIDER_KEYS,
  isolateProviderEnv,
  stubFetchOk,
} from "../fixtures/config";
import { resetModelReply, setModelReply } from "../fixtures/model-mock";

export type TuiScene = Scene & {
  pressArrowDown(): Promise<void>;
}

type RenderOptions = {
  connectedProviderKeys?: Record<string, string>;
}

type RenderSetup = Awaited<ReturnType<typeof testRender>>;

const renderScene = async (options: RenderOptions) => {
  const restoreEnv = isolateProviderEnv(options.connectedProviderKeys ?? {});
  const restoreFetch = stubFetchOk();
  let setup!: RenderSetup;
  await act(async () => {
    setup = await testRender(<Root config={buildConfig()} />, {
      exitOnCtrlC: false,
      height: 40,
      width: 120,
    });
    await setup.waitForVisualIdle();
  });

  const settle = async (interact: () => Promise<void> | void) => {
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
      eventuallyShows: async (text) => {
        await act(async () => {
          for (let pass = 0; pass < 50; pass += 1) {
            await setup.flush();
            if (setup.captureCharFrame().includes(text)) return;
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
        });
        frameShows(text);
      },
      hides: (text) => {
        expect(setup.captureCharFrame()).not.toContain(text);
      },
      shows: frameShows,
    },
    dispose: async () => {
      await act(async () => {
        await setup.flush();
        setup.renderer.destroy();
      });
      restoreFetch();
      restoreEnv();
    },
    pressArrowDown: () =>
      settle(() => {
        setup.mockInput.pressArrow("down");
      }),
  };
};

export const tuiHarness = {
  connected: () => {
    resetModelReply();
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
  connectedWithReply: (reply: string) => {
    setModelReply(reply);
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
  unconnected: () => {
    resetModelReply();
    return renderScene({});
  },
};
