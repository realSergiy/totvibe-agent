#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { defineCommand, runMain } from "citty";
import { loadInitialConfig } from "./config";
import { App } from "./App";

const main = defineCommand({
  meta: {
    name: "totvibe",
    description: "A minimalist terminal coding assistant.",
  },
  args: {
    sandbox: {
      type: "boolean",
      default: true,
      description:
        "Confine file tools and run_bash to the working directory. Pass --no-sandbox to disable.",
    },
  },
  async run({ args }) {
    const config = loadInitialConfig({ sandbox: args.sandbox });
    const renderer = await createCliRenderer({
      exitOnCtrlC: false,
      targetFps: 30,
      useMouse: false,
    });
    createRoot(renderer).render(<App config={config} />);
  },
});

void runMain(main);
