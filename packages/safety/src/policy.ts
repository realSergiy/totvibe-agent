import type { ToolRisk } from '@totvibe/core';

export type PolicyMode = 'auto' | 'default';

export type PolicyVerdict = {
  absolute: boolean;
  decision: 'allow' | 'ask' | 'deny';
  reason: string;
};

export type ToolAction = {
  command?: string;
  input: unknown;
  name: string;
  path?: string;
  risk: ToolRisk;
};

type AbsoluteDenyRule = {
  id: string;
  matches: (action: ToolAction) => boolean;
  reason: string;
};

export const resolveAction = (name: string, risk: ToolRisk, input: unknown) => {
  const fields: Record<string, unknown> = input && typeof input === 'object' ? { ...input } : {};
  const command = typeof fields.command === 'string' ? fields.command : undefined;
  const path = typeof fields.path === 'string' ? fields.path : undefined;
  return { command, input, name, path, risk };
};

const RECURSIVE_DELETE =
  /\brm\b(?=[^\n]*\s(?:-[a-z]*r|--recursive))(?=[^\n]*\s(?:-[a-z]*f|--force))[^\n]*\s(\/\*|\/|~|\$HOME)(\s|$|\/)/;
const FORK_BOMB = /:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:[^}]*\}\s*;\s*:/;
const PIPE_TO_SHELL = /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/;
const WIPE_DEVICE = /\b(mkfs\b|dd\b[^\n]*\bof=\/dev\/|>\s*\/dev\/(sd|nvme|vd|disk))/;
const SECRET_MARKERS = /(\.ssh\/|id_rsa|id_ed25519|\.aws\/credentials|\/etc\/shadow|\.pem\b)/;

const isForcePush = (command: string) => {
  if (!/\bgit\b[^\n]*\bpush\b/.test(command)) return false;
  if (/--force-with-lease\b/.test(command)) return false;
  return /--force\b/.test(command) || /\s-f(\s|$)/.test(command);
};

const ABSOLUTE_DENY_RULES: AbsoluteDenyRule[] = [
  {
    id: 'recursive-root-delete',
    matches: action => Boolean(action.command && RECURSIVE_DELETE.test(action.command)),
    reason: 'recursive delete of a root or home path',
  },
  {
    id: 'fork-bomb',
    matches: action => Boolean(action.command && FORK_BOMB.test(action.command)),
    reason: 'fork bomb',
  },
  {
    id: 'force-push',
    matches: action => Boolean(action.command && isForcePush(action.command)),
    reason: 'force-push (use --force-with-lease instead)',
  },
  {
    id: 'pipe-network-to-shell',
    matches: action => Boolean(action.command && PIPE_TO_SHELL.test(action.command)),
    reason: 'piping a network download straight into a shell',
  },
  {
    id: 'wipe-device',
    matches: action => Boolean(action.command && WIPE_DEVICE.test(action.command)),
    reason: 'overwriting a raw block device or filesystem',
  },
  {
    id: 'touch-private-keys',
    matches: action => [action.command, action.path].some(value => value !== undefined && SECRET_MARKERS.test(value)),
    reason: 'reading or writing private keys / credential files',
  },
];

export const decidePolicy = (action: ToolAction, mode: PolicyMode) => {
  const denied = matchAbsoluteDeny(action);
  if (denied) return { absolute: true, decision: 'deny', reason: denied.reason };
  if (action.risk === 'read') return { absolute: false, decision: 'allow', reason: 'read-only' };
  if (mode === 'auto') return { absolute: false, decision: 'allow', reason: 'auto mode' };
  return { absolute: false, decision: 'ask', reason: 'a mutating action needs approval' };
};

export const matchAbsoluteDeny = (action: ToolAction) => ABSOLUTE_DENY_RULES.find(rule => rule.matches(action));
