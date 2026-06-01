#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { loadInitialConfig } from "@totvibe/runtime";
import { defineCommand, runMain } from "citty";

import { Root } from "./Root";

const main = defineCommand({
  args: {
    continue: {
      default: false,
      description: "Resume the most recently saved session.",
      type: "boolean",
    },
    port: {
      default: "3000",
      description: "Port for --serve (default 3000).",
      type: "string",
    },
    resume: {
      description: "Resume a saved session by id (see ~/.totvibe/sessions).",
      type: "string",
    },
    sandbox: {
      default: true,
      description:
        "Confine file tools and run_bash to the working directory. Pass --no-sandbox to disable.",
      type: "boolean",
    },
    serve: {
      default: false,
      description: "Serve the web UI over HTTP instead of the terminal UI.",
      type: "boolean",
    },
  },
  meta: {
    description: "A minimalist terminal coding assistant.",
    name: "totvibe",
  },
  run: async ({ args }) => {
    if (args.serve) {
      const { startServer } = await import("@totvibe/web/server");
      startServer({ port: Number.parseInt(args.port, 10) || 3000, sandbox: args.sandbox });
      return;
    }
    const config = await loadInitialConfig({
      continueLast: args.continue,
      resume: args.resume,
      sandbox: args.sandbox,
    });
    const renderer = await createCliRenderer({
      exitOnCtrlC: false,
      targetFps: 30,
      useMouse: false,
    });
    createRoot(renderer).render(<Root config={config} />);
  },
});

void runMain(main);
