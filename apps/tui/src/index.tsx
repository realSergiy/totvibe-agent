#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { defineCommand, runMain } from "citty";
import { loadInitialConfig } from "@totvibe/runtime";
import { Root } from "./Root";

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
    resume: {
      type: "string",
      description: "Resume a saved session by id (see ~/.totvibe/sessions).",
    },
    continue: {
      type: "boolean",
      default: false,
      description: "Resume the most recently saved session.",
    },
    serve: {
      type: "boolean",
      default: false,
      description: "Serve the web UI over HTTP instead of the terminal UI.",
    },
    port: {
      type: "string",
      default: "3000",
      description: "Port for --serve (default 3000).",
    },
  },
  async run({ args }) {
    if (args.serve) {
      const { startServer } = await import("@totvibe/web/server");
      startServer({ sandbox: args.sandbox, port: Number.parseInt(args.port, 10) || 3000 });
      return;
    }
    const config = await loadInitialConfig({
      sandbox: args.sandbox,
      resume: args.resume,
      continueLast: args.continue,
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
