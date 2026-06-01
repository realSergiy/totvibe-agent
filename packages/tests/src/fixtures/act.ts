import { act } from "react";
import type { World } from "./world";

export function createAct(world: World) {
  const settle = async (interact: () => void | Promise<void>) => {
    await act(async () => {
      await interact();
    });
    await world.setup.flush();
  };

  return {
    type: (text: string) => settle(() => world.setup.mockInput.typeText(text)),
    typeAndSubmit: (text: string) =>
      settle(async () => {
        await world.setup.mockInput.typeText(text);
        world.setup.mockInput.pressEnter();
      }),
    pressArrowDown: () =>
      settle(() => {
        world.setup.mockInput.pressArrow("down");
      }),
    pressKey: (key: string) =>
      settle(() => {
        world.setup.mockInput.pressKey(key);
      }),
  };
}

export type Act = ReturnType<typeof createAct>;
