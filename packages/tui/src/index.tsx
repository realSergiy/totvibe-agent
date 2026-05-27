#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { loadInitialConfig } from "./config";
import { App } from "./App";

const config = loadInitialConfig();

const renderer = await createCliRenderer({ exitOnCtrlC: false, targetFps: 30 });
createRoot(renderer).render(<App config={config} />);
