import { describe, expect, test, vi } from 'vitest';

import { helperPath, makeScratchDir, probeSandbox, runSandboxedBash, SandboxState, writeStubHelper } from '#sandbox';

describe('1.1 tracking writable and readable directories', () => {
  test('1.1.1 allows writes inside the working directory and default writable paths', async () => {
    const cwd = await makeScratchDir();
    const state = new SandboxState(cwd);
    expect(state.allowsWrite(`${cwd}/notes.txt`)).toBe(true);
    expect(state.allowsWrite('/tmp/scratch.txt')).toBe(true);
    expect(state.allowsWrite('/home/someone-else/secret.txt')).toBe(false);
  });

  test('1.1.2 grants additional read-write and read-only directories on request', async () => {
    const cwd = await makeScratchDir();
    const state = new SandboxState(cwd);
    state.grantReadWrite('/var/shared');
    state.grantReadOnly('/var/reference');
    expect(state.allowsWrite('/var/shared/report.txt')).toBe(true);
    expect(state.readWriteDirs()).toContain('/var/shared');
    expect(state.readOnlyDirs()).toContain('/var/reference');
  });

  test('1.1.3 serializes the grants into helper environment variables', async () => {
    const cwd = await makeScratchDir();
    const state = new SandboxState(cwd);
    const env = state.toEnv('none');
    expect(env.SANDBOX_NET).toBe('none');
    expect(env.SANDBOX_RW_PATHS.split(':')).toContain(cwd);
    expect(env.SANDBOX_RO_PATHS.split(':')).toContain('/etc');
  });
});

describe('1.2 locating and probing the sandbox helper', () => {
  test('1.2.1 resolves the helper binary from the environment override', () => {
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', '/opt/custom/totvibe-sandbox');
    expect(helperPath()).toBe('/opt/custom/totvibe-sandbox');
  });

  test('1.2.2 reports the sandbox disabled when the user opted out', async () => {
    expect(await probeSandbox('none', false)).toEqual({
      available: false,
      degraded: false,
      enabled: false,
      hasLandlock: false,
      net: 'none',
    });
  });

  test('1.2.3 reports a degraded sandbox when the helper binary is missing', async () => {
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', '/nonexistent/totvibe-sandbox');
    expect(await probeSandbox('none')).toEqual({
      available: false,
      degraded: true,
      enabled: true,
      hasLandlock: false,
      net: 'none',
    });
  });

  test('1.2.4 detects landlock support from the helper probe output', async () => {
    const dir = await makeScratchDir();
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', await writeStubHelper(dir, 'echo landlock=ok'));
    expect(await probeSandbox('inherit')).toEqual({
      available: true,
      degraded: false,
      enabled: true,
      hasLandlock: true,
      net: 'inherit',
    });
  });
});

describe('1.3 running shell commands through the sandbox', () => {
  test('1.3.1 runs the command through the helper when it is available', async () => {
    const cwd = await makeScratchDir();
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', await writeStubHelper(cwd, 'exec bash -c "$1"'));
    const run = await runSandboxedBash('echo confined && echo oops >&2', new SandboxState(cwd), cwd, 'none');
    expect(run).toEqual({ exitCode: 0, sandboxed: true, stderr: 'oops\n', stdout: 'confined\n' });
  });

  test('1.3.2 falls back to plain bash when sandboxing is disabled', async () => {
    const cwd = await makeScratchDir();
    const run = await runSandboxedBash('echo unconfined', new SandboxState(cwd), cwd, 'none', undefined, false);
    expect(run).toEqual({ exitCode: 0, sandboxed: false, stderr: '', stdout: 'unconfined\n' });
  });

  const FAILING_EXIT_CODE = 3;

  test('1.3.3 reports the exit code of a failing command', async () => {
    const cwd = await makeScratchDir();
    const run = await runSandboxedBash(
      `exit ${String(FAILING_EXIT_CODE)}`,
      new SandboxState(cwd),
      cwd,
      'none',
      undefined,
      false,
    );
    expect(run.exitCode).toBe(FAILING_EXIT_CODE);
    expect(run.sandboxed).toBe(false);
  });
});
