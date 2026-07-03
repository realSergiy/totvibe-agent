import type { AnyToolDef, ToolContext } from '@totvibe/core';

import { SandboxState } from '@totvibe/sandbox';
import { createBuiltinTools, type ToolOptions } from '@totvibe/tools';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export { writeStubHelper } from '#sandbox';

export const OUTPUT_CHAR_CAP = 100_000;

export const makeToolbox = async (options: ToolOptions = {}) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'totvibe-tools-'));
  const sandbox = new SandboxState(cwd);
  const tools: AnyToolDef[] = createBuiltinTools(sandbox, options);
  const context: ToolContext = { cwd };
  const run = async (name: string, input: unknown) => {
    const tool = tools.find(definition => definition.name === name);
    if (!tool) throw new Error(`no such builtin tool: ${name}`);
    return tool.execute(input, context);
  };
  return { cwd, run, sandbox, tools };
};
