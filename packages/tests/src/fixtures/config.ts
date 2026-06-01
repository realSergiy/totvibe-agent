import type { InitialConfig } from "@totvibe/runtime";

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

export const CONNECTED_PROVIDER_KEYS = { DASHSCOPE_API_KEY: "fixture-key-qwen" };

export function buildConfig(): InitialConfig {
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

export function isolateProviderEnv(connectedKeys: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>();
  for (const name of PROVIDER_KEY_ENV_VARS) {
    previous.set(name, process.env[name]);
    Reflect.deleteProperty(process.env, name);
  }
  for (const [name, value] of Object.entries(connectedKeys)) {
    process.env[name] = value;
  }
  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = value;
    }
  };
}

export function stubFetchOk(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response(null, { status: 200 }))) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
