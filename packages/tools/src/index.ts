import { defineTool } from '@totvibe/core';
import { type NetPolicy, runSandboxedBash, type SandboxState } from '@totvibe/sandbox';
import { realpath } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { z } from 'zod';

export type ToolOptions = {
  net?: NetPolicy;
  sandbox?: boolean;
};

const OUTPUT_CHAR_CAP = 100_000;
const spillCounter = { value: 0 };

const capOutput = async (text: string, label: string) => {
  if (text.length <= OUTPUT_CHAR_CAP) return text;
  spillCounter.value += 1;
  const spillPath = nodePath.join(
    tmpdir(),
    'totvibe',
    `${label}-${String(process.pid)}-${String(spillCounter.value)}.txt`,
  );
  await Bun.write(spillPath, text);
  const head = text.slice(0, OUTPUT_CHAR_CAP);
  return `${head}\n\n[output truncated: showed ${String(OUTPUT_CHAR_CAP)} of ${String(text.length)} chars; full output saved to ${spillPath} — read_file it if you need the rest]`;
};

const canonicalizePath = async (target: string) => {
  const tail: string[] = [];
  let current = target;
  for (;;) {
    try {
      const real = await realpath(current);
      return tail.length > 0 ? nodePath.join(real, ...tail) : real;
    } catch {
      const parent = nodePath.dirname(current);
      if (parent === current) return target;
      tail.unshift(nodePath.basename(current));
      current = parent;
    }
  }
};

export const createBuiltinTools = (sandbox: SandboxState, options: ToolOptions = {}) => {
  const net: NetPolicy = options.net ?? 'none';
  const isSandboxEnabled = options.sandbox ?? true;

  const resolveInSandbox = async (cwd: string, path: string) => {
    const target = nodePath.resolve(cwd, path);
    if (!isSandboxEnabled) return target;
    if (!sandbox.allowsWrite(target)) {
      throw new Error(`Path outside the sandbox's writable dirs: ${path}. Ask the user to /grant it.`);
    }
    const canonical = await canonicalizePath(target);
    if (!sandbox.allowsWrite(canonical)) {
      throw new Error(`Path escapes the sandbox via a symlink: ${path}. Ask the user to /grant it.`);
    }
    return target;
  };

  const readFile = defineTool({
    description: 'Read a UTF-8 text file inside the sandbox.',
    execute: async ({ path }, { cwd }) => {
      const file = Bun.file(await resolveInSandbox(cwd, path));
      if (!(await file.exists())) throw new Error(`No such file: ${path}`);
      return await capOutput(await file.text(), 'read_file');
    },
    inputSchema: z.object({
      path: z.string().describe('File path relative to the working directory'),
    }),
    name: 'read_file',
    risk: 'read',
  });

  const listDir = defineTool({
    description: 'List the entries of a directory inside the sandbox.',
    execute: async ({ path }, { cwd }) => {
      const entries = await readdir(await resolveInSandbox(cwd, path), {
        withFileTypes: true,
      });
      const names = entries
        .map(entry => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .toSorted((a, b) => a.localeCompare(b));
      return await capOutput(names.join('\n') || '(empty)', 'list_dir');
    },
    inputSchema: z.object({
      path: z.string().default('.').describe('Directory path relative to the working directory'),
    }),
    name: 'list_dir',
    risk: 'read',
  });

  const writeFile = defineTool({
    description: 'Create or overwrite a UTF-8 text file inside the sandbox.',
    execute: async ({ content, path }, { cwd }) => {
      await Bun.write(await resolveInSandbox(cwd, path), content);
      return `Wrote ${String(content.length)} bytes to ${path}`;
    },
    inputSchema: z.object({
      content: z.string().describe('Full contents to write'),
      path: z.string().describe('File path relative to the working directory'),
    }),
    name: 'write_file',
    risk: 'mutate',
  });

  const runBash = defineTool({
    description: 'Run a shell command in a Landlock+namespace sandbox and return its combined output.',
    execute: async ({ command }, { cwd, signal }) => {
      const result = await runSandboxedBash(command, sandbox, cwd, net, signal, isSandboxEnabled);
      const body = [result.stdout, result.stderr].filter(Boolean).join('\n').trimEnd();
      const tag = result.sandboxed ? '' : ' (unsandboxed)';
      return await capOutput(`exit ${String(result.exitCode)}${tag}\n${body}`.trimEnd(), 'run_bash');
    },
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
    }),
    name: 'run_bash',
    risk: 'mutate',
  });

  return [readFile, listDir, writeFile, runBash];
};
