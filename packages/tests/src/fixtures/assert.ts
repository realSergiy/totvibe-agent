import { act } from "react";
import { expect } from "bun:test";
import type { World } from "./world";

export function createAssert(world: World) {
  const frameShows = (text: string) => {
    expect(world.setup.captureCharFrame()).toContain(text);
  };

  return {
    frameShows,

    frameHides(text: string) {
      expect(world.setup.captureCharFrame()).not.toContain(text);
    },

    async frameEventuallyShows(text: string) {
      await act(async () => {
        for (let pass = 0; pass < 50; pass += 1) {
          await world.setup.flush();
          if (world.setup.captureCharFrame().includes(text)) return;
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      });
      frameShows(text);
    },
  };
}

export type Assert = ReturnType<typeof createAssert>;
