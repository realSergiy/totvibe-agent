import { mkdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { isolateEnv, loadInitialConfig, makeScratchDir } from '#runtime';

const GLM_CONTEXT_WINDOW = 204_800;
const TOKEN_BUDGET_CONTEXT_WINDOWS = 8;
const DEFAULT_MAX_STEPS = 24;
const DEFAULT_WALL_CLOCK_MS = 600_000;
const OVERRIDDEN_MAX_STEPS = 5;
const OVERRIDDEN_APPROVAL_TIMEOUT_MS = 1000;
const MINUTE_MS = 60_000;

const clearConfigEnv = () => {
  isolateEnv();
  for (const name of [
    'AI_PROVIDER',
    'MODEL',
    'AUTO_APPROVE',
    'TOTVIBE_DATA_DIR',
    'TOTVIBE_SANDBOX_NET',
    'TOTVIBE_APPROVAL_TIMEOUT_MS',
    'TOTVIBE_MAX_STEPS',
    'TOTVIBE_TOKEN_BUDGET',
    'TOTVIBE_WALL_CLOCK_MS',
  ]) {
    vi.stubEnv(name, undefined);
  }
};

const seedSession = async (sessionsDir: string, sessionId: string, text: string, modifiedAt: Date) => {
  const sessionPath = path.join(sessionsDir, `${sessionId}.jsonl`);
  await writeFile(sessionPath, `${JSON.stringify({ message: { content: text, role: 'user' } })}\n`);
  await utimes(sessionPath, modifiedAt, modifiedAt);
};

describe('2.1 resolving the provider', () => {
  test('2.1.1 defaults to the default provider and its model', async () => {
    clearConfigEnv();
    const config = await loadInitialConfig({ sandbox: true });
    expect(config.providerName).toBe('glm');
    expect(config.modelId).toBe('glm-5.1');
    expect(config.autoApprove).toBe(false);
    expect(config.sandbox).toBe(true);
    expect(config.sandboxNet).toBe('none');
    expect(config.cwd).toBe(process.cwd());
    expect(config.system).toContain('totvibe');
  });

  test('2.1.2 honors provider, model, approval, and network overrides from the environment', async () => {
    clearConfigEnv();
    vi.stubEnv('AI_PROVIDER', 'QWEN');
    vi.stubEnv('MODEL', 'qwen-experimental');
    vi.stubEnv('AUTO_APPROVE', '1');
    vi.stubEnv('TOTVIBE_SANDBOX_NET', 'inherit');
    const config = await loadInitialConfig({ sandbox: false });
    expect(config.providerName).toBe('qwen');
    expect(config.modelId).toBe('qwen-experimental');
    expect(config.autoApprove).toBe(true);
    expect(config.sandbox).toBe(false);
    expect(config.sandboxNet).toBe('inherit');
  });

  test('2.1.3 rejects an unknown provider naming the known ones', async () => {
    clearConfigEnv();
    vi.stubEnv('AI_PROVIDER', 'skynet');
    await expect(loadInitialConfig({ sandbox: true })).rejects.toThrow(/Unknown AI_PROVIDER "skynet".*glm.*qwen/);
  });
});

describe('2.2 deriving agent limits', () => {
  test('2.2.1 defaults the limits from the provider metadata', async () => {
    clearConfigEnv();
    const { limits } = await loadInitialConfig({ sandbox: true });
    expect(limits).toEqual({
      approvalTimeoutMs: 0,
      maxSteps: DEFAULT_MAX_STEPS,
      tokenBudget: GLM_CONTEXT_WINDOW * TOKEN_BUDGET_CONTEXT_WINDOWS,
      wallClockMs: DEFAULT_WALL_CLOCK_MS,
    });
  });

  test('2.2.2 honors positive integer overrides and ignores invalid ones', async () => {
    clearConfigEnv();
    vi.stubEnv('TOTVIBE_MAX_STEPS', String(OVERRIDDEN_MAX_STEPS));
    vi.stubEnv('TOTVIBE_APPROVAL_TIMEOUT_MS', String(OVERRIDDEN_APPROVAL_TIMEOUT_MS));
    vi.stubEnv('TOTVIBE_TOKEN_BUDGET', 'not-a-number');
    vi.stubEnv('TOTVIBE_WALL_CLOCK_MS', '-3');
    const { limits } = await loadInitialConfig({ sandbox: true });
    expect(limits.maxSteps).toBe(OVERRIDDEN_MAX_STEPS);
    expect(limits.approvalTimeoutMs).toBe(OVERRIDDEN_APPROVAL_TIMEOUT_MS);
    expect(limits.tokenBudget).toBe(GLM_CONTEXT_WINDOW * TOKEN_BUDGET_CONTEXT_WINDOWS);
    expect(limits.wallClockMs).toBe(DEFAULT_WALL_CLOCK_MS);
  });
});

describe('2.3 resolving the session and data paths', () => {
  test('2.3.1 starts a fresh session under the data directory by default', async () => {
    clearConfigEnv();
    const dataDir = await makeScratchDir();
    vi.stubEnv('TOTVIBE_DATA_DIR', dataDir);
    const config = await loadInitialConfig({ sandbox: true });
    expect(config.sessionId).toMatch(/[0-9a-f-]{36}/);
    expect(config.initialMessages).toEqual([]);
    expect(config.paths).toEqual({
      auditPath: path.join(dataDir, 'audit.jsonl'),
      sessionsDir: path.join(dataDir, 'sessions'),
    });
  });

  test('2.3.2 continues the most recently saved session', async () => {
    clearConfigEnv();
    const dataDir = await makeScratchDir();
    vi.stubEnv('TOTVIBE_DATA_DIR', dataDir);
    const sessionsDir = path.join(dataDir, 'sessions');
    await mkdir(sessionsDir, { recursive: true });
    await seedSession(sessionsDir, 'older', 'first', new Date(Date.now() - MINUTE_MS));
    await seedSession(sessionsDir, 'newer', 'second', new Date());
    const config = await loadInitialConfig({ continueLast: true, sandbox: true });
    expect(config.sessionId).toBe('newer');
    expect(config.initialMessages).toEqual([{ content: 'second', role: 'user' }]);
  });

  test('2.3.3 resumes an explicitly named session', async () => {
    clearConfigEnv();
    const dataDir = await makeScratchDir();
    vi.stubEnv('TOTVIBE_DATA_DIR', dataDir);
    const sessionsDir = path.join(dataDir, 'sessions');
    await mkdir(sessionsDir, { recursive: true });
    await seedSession(sessionsDir, 'chosen', 'kept', new Date());
    const config = await loadInitialConfig({ resume: 'chosen', sandbox: true });
    expect(config.sessionId).toBe('chosen');
    expect(config.initialMessages).toEqual([{ content: 'kept', role: 'user' }]);
  });
});
