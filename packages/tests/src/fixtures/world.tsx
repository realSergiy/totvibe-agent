import { act } from "react";
import { testRender } from "@opentui/react/test-utils";
import { TotvibeApp } from "@totvibe/tui/root";
import type { InitialConfig } from "@totvibe/tui/providers/config";

const PROVIDER_KEY_ENV_VARS = [
  "DASHSCOPE_API_KEY",
  "ZAI_API_KEY",
  "ZHIPU_API_KEY",
  "MOONSHOT_API_KEY",
  "MIMO_API_KEY",
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "MINIMAX_API_KEY",
  "MISTRAL_API_KEY",
];

function buildConfig(): InitialConfig {
  return {
    providerName: "qwen",
    modelId: "qwen3.7-max",
    system: "fixture system prompt",
    cwd: "/home/test/project",
    autoApprove: false,
    sandbox: true,
    sandboxNet: "none",
    limits: { maxSteps: 24, wallClockMs: 600_000, tokenBudget: 1_000_000, approvalTimeoutMs: 0 },
    paths: { sessionsDir: "/tmp/totvibe-test/sessions", auditPath: "/tmp/totvibe-test/audit.jsonl" },
    sessionId: "fixture-session",
    initialMessages: [],
  };
}

type RenderSetup = Awaited<ReturnType<typeof testRender>>;

export interface World {
  setup: RenderSetup;
  dispose(): Promise<void>;
}

export interface WorldOptions {
  connectedProviderKeys?: Record<string, string>;
}

export async function renderWorld(options: WorldOptions = {}): Promise<World> {
  const restoreEnv = isolateProviderEnv(options.connectedProviderKeys ?? {});
  const restoreFetch = stubFetchOk();
  let setup!: RenderSetup;
  await act(async () => {
    setup = await testRender(<TotvibeApp config={buildConfig()} />, {
      width: 120,
      height: 40,
      exitOnCtrlC: false,
    });
    await setup.waitForVisualIdle();
  });
  return {
    setup,
    async dispose() {
      await act(async () => {
        setup.renderer.destroy();
      });
      restoreFetch();
      restoreEnv();
    },
  };
}

function isolateProviderEnv(connectedKeys: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>();
  for (const name of PROVIDER_KEY_ENV_VARS) {
    previous.set(name, process.env[name]);
    delete process.env[name];
  }
  for (const [name, value] of Object.entries(connectedKeys)) {
    process.env[name] = value;
  }
  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

function stubFetchOk(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
