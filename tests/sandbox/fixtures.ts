import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export { helperPath, probeSandbox, runSandboxedBash, SandboxState } from '@totvibe/sandbox';

export const makeScratchDir = () => mkdtemp(path.join(tmpdir(), 'totvibe-sandbox-'));

export const writeStubHelper = async (dir: string, script: string) => {
  const binaryPath = path.join(dir, 'totvibe-sandbox');
  await Bun.write(binaryPath, `#!/bin/sh\n${script}\n`);
  const chmod = Bun.spawn(['chmod', '+x', binaryPath]);
  await chmod.exited;
  return binaryPath;
};
