import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { makeToolbox, OUTPUT_CHAR_CAP, writeStubHelper } from '#tools';

describe('1.1 reading files inside the sandbox', () => {
  test('1.1.1 reads a UTF-8 file relative to the working directory', async () => {
    const { cwd, run } = await makeToolbox();
    await writeFile(path.join(cwd, 'notes.txt'), 'remember the milk');
    expect(await run('read_file', { path: 'notes.txt' })).toBe('remember the milk');
  });

  test('1.1.2 reports a missing file by its requested path', async () => {
    const { run } = await makeToolbox();
    await expect(run('read_file', { path: 'ghost.txt' })).rejects.toThrow('No such file: ghost.txt');
  });

  test('1.1.3 refuses paths outside the writable directories', async () => {
    const { run } = await makeToolbox();
    await expect(run('read_file', { path: '/etc/hostname' })).rejects.toThrow(
      "Path outside the sandbox's writable dirs",
    );
  });

  test('1.1.4 refuses paths that escape the sandbox through a symlink', async () => {
    const { cwd, run } = await makeToolbox();
    await symlink('/etc', path.join(cwd, 'escape'));
    await expect(run('read_file', { path: 'escape/hostname' })).rejects.toThrow('escapes the sandbox via a symlink');
  });

  test('1.1.5 truncates oversized output to a spill file', async () => {
    const { cwd, run } = await makeToolbox();
    await writeFile(path.join(cwd, 'big.txt'), 'x'.repeat(OUTPUT_CHAR_CAP + 1));
    const TRUNCATION_NOTICE_MAX_CHARS = 500;
    const output = await run('read_file', { path: 'big.txt' });
    expect(output).toContain('[output truncated');
    expect(output.length).toBeLessThan(OUTPUT_CHAR_CAP + TRUNCATION_NOTICE_MAX_CHARS);
  });
});

describe('1.2 listing directories', () => {
  test('1.2.1 lists entries sorted with a trailing slash on directories', async () => {
    const { cwd, run } = await makeToolbox();
    await mkdir(path.join(cwd, 'src'));
    await writeFile(path.join(cwd, 'README.md'), '# hi');
    expect(await run('list_dir', { path: '.' })).toBe('README.md\nsrc/');
  });

  test('1.2.2 describes an empty directory as empty', async () => {
    const { run } = await makeToolbox();
    expect(await run('list_dir', { path: '.' })).toBe('(empty)');
  });
});

describe('1.3 writing files', () => {
  test('1.3.1 creates a file and reports the bytes written', async () => {
    const { cwd, run } = await makeToolbox();
    expect(await run('write_file', { content: 'hello', path: 'out.txt' })).toBe('Wrote 5 bytes to out.txt');
    expect(await Bun.file(path.join(cwd, 'out.txt')).text()).toBe('hello');
  });

  test('1.3.2 refuses to write outside the sandbox unless sandboxing is off', async () => {
    const confined = await makeToolbox();
    await expect(confined.run('write_file', { content: 'x', path: '/home/other/out.txt' })).rejects.toThrow(
      "Path outside the sandbox's writable dirs",
    );
    const unconfined = await makeToolbox({ sandbox: false });
    const target = path.join(unconfined.cwd, 'anywhere.txt');
    expect(await unconfined.run('write_file', { content: 'x', path: target })).toContain('Wrote 1 bytes');
  });
});

describe('1.4 running shell commands', () => {
  test('1.4.1 reports the exit code and combined output of a command', async () => {
    const { run } = await makeToolbox({ sandbox: false });
    expect(await run('run_bash', { command: 'echo hi && echo err >&2' })).toBe('exit 0 (unsandboxed)\nhi\n\nerr');
  });

  test('1.4.2 reports a nonzero exit code without throwing', async () => {
    const { run } = await makeToolbox({ sandbox: false });
    expect(await run('run_bash', { command: 'exit 7' })).toBe('exit 7 (unsandboxed)');
  });

  test('1.4.3 runs through the sandbox helper without the unsandboxed tag', async () => {
    const { cwd, run } = await makeToolbox();
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', await writeStubHelper(cwd, 'exec bash -c "$1"'));
    expect(await run('run_bash', { command: 'echo confined' })).toBe('exit 0\nconfined');
  });
});
