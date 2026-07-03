import type { ToolInvocation } from '@totvibe/core';
import type { ToolAction } from '@totvibe/safety';

export {
  type ApprovalRequest,
  AuditLedger,
  decidePolicy,
  matchAbsoluteDeny,
  type PolicyDecisionRecord,
  policyGate,
  resolveAction,
} from '@totvibe/safety';

export const commandAction = (command: string): ToolAction => ({
  command,
  input: { command },
  name: 'run_bash',
  risk: 'mutate',
});

export const mutatingInvocation: ToolInvocation = {
  input: { command: 'touch note.txt' },
  name: 'run_bash',
  risk: 'mutate',
};

export const readInvocation: ToolInvocation = {
  input: { path: 'README.md' },
  name: 'read_file',
  risk: 'read',
};

export const runNext = () => Promise.resolve('tool output');
