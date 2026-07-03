import type { ServerEvent } from '@totvibe/protocol';
import type { InitialConfig, RuntimeHost } from '@totvibe/runtime';

import { createRuntime } from '@totvibe/runtime';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

import { buildConfig } from '#fixtures/config';

export { buildConfig, CONNECTED_PROVIDER_KEYS } from '#fixtures/config';
export { scriptModelTurns, setModelReply, textTurn, toolCallTurn } from '#model-mock';

export { DEFAULT_PROVIDER, findProvider, PROVIDERS, type ServerEvent } from '@totvibe/protocol';
export {
  buildModel,
  bunHost,
  createRuntime,
  type InitialConfig,
  isConnected,
  loadInitialConfig,
  type RuntimeHost,
  validateApiKey,
} from '@totvibe/runtime';

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

export const isolateEnv = (connectedKeys: Record<string, string> = {}) => {
  for (const name of PROVIDER_KEY_ENV_VARS) vi.stubEnv(name, undefined);
  for (const [name, value] of Object.entries(connectedKeys)) vi.stubEnv(name, value);
};

export const HTTP_OK = 200;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_INTERNAL_SERVER_ERROR = 500;

export const stubFetch = (reply: Error | number) => {
  const stub: typeof globalThis.fetch = Object.assign(
    () =>
      reply instanceof Error ? Promise.reject(reply) : Promise.resolve(new Response(undefined, { status: reply })),
    { preconnect: () => void 0 },
  );
  vi.stubGlobal('fetch', stub);
};

export const makeScratchDir = () => mkdtemp(path.join(tmpdir(), 'totvibe-runtime-'));

export const captureHost = () => {
  const saved: Record<string, string>[] = [];
  const host: RuntimeHost = {
    saveEnvVars: updates => {
      saved.push(updates);
      for (const [name, value] of Object.entries(updates)) vi.stubEnv(name, value);
      return Promise.resolve();
    },
  };
  return { host, saved };
};

const EVENT_WAIT_MAX_PASSES = 500;
const EVENT_WAIT_PASS_DELAY_MS = 2;

export const makeRuntime = async (overrides: Partial<InitialConfig> = {}, host?: RuntimeHost) => {
  const dataDir = await makeScratchDir();
  const config: InitialConfig = {
    ...buildConfig(),
    cwd: dataDir,
    paths: { auditPath: path.join(dataDir, 'audit.jsonl'), sessionsDir: path.join(dataDir, 'sessions') },
    ...overrides,
  };
  const runtime = createRuntime(config, host ?? captureHost().host);
  const events: ServerEvent[] = [];
  runtime.subscribe(event => {
    events.push(event);
  });
  const expectEvent = async (describes: string, isMatch: (event: ServerEvent) => boolean) => {
    for (let pass = 0; pass < EVENT_WAIT_MAX_PASSES; pass += 1) {
      const found = events.find(event => isMatch(event));
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, EVENT_WAIT_PASS_DELAY_MS));
    }
    throw new Error(`runtime never emitted an event that ${describes}`);
  };
  return { config, events, expectEvent, runtime };
};
