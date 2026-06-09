import type { InitialConfig } from '@totvibe/runtime';

const PROVIDER_KEY_ENV_VARS = [
  'DASHSCOPE_API_KEY',
  'ZAI_API_KEY',
  'ZHIPU_API_KEY',
  'MOONSHOT_API_KEY',
  'MIMO_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'MINIMAX_API_KEY',
  'MISTRAL_API_KEY',
];

export const CONNECTED_PROVIDER_KEYS = { DASHSCOPE_API_KEY: 'fixture-key-qwen' };

export const buildConfig = () =>
  ({
    autoApprove: false,
    cwd: '/home/test/project',
    initialMessages: [],
    limits: { approvalTimeoutMs: 0, maxSteps: 24, tokenBudget: 1_000_000, wallClockMs: 600_000 },
    modelId: 'qwen3.7-max',
    paths: { auditPath: '/tmp/totvibe-test/audit.jsonl', sessionsDir: '/tmp/totvibe-test/sessions' },
    providerName: 'qwen',
    sandbox: true,
    sandboxNet: 'none',
    sessionId: 'fixture-session',
    system: 'fixture system prompt',
  }) satisfies InitialConfig;

export const isolateProviderEnv = (connectedKeys: Record<string, string>) => {
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
};

export const stubFetchOk = () => {
  const original = globalThis.fetch;
  const stub: typeof globalThis.fetch = Object.assign(() => Promise.resolve(new Response(undefined, { status: 200 })), {
    preconnect: () => void 0,
  });
  globalThis.fetch = stub;
  return () => {
    globalThis.fetch = original;
  };
};
