import type { ToolRisk } from "@totvibe/core";

export type PolicyMode = "default" | "auto";

export interface ToolAction {
  name: string;
  risk: ToolRisk;
  input: unknown;
  command?: string;
  path?: string;
}

export interface PolicyVerdict {
  decision: "allow" | "deny" | "ask";
  reason: string;
  absolute: boolean;
}

export function resolveAction(name: string, risk: ToolRisk, input: unknown): ToolAction {
  const fields = input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;
  const command = typeof fields?.command === "string" ? fields.command : undefined;
  const path = typeof fields?.path === "string" ? fields.path : undefined;
  return { name, risk, input, command, path };
}

interface AbsoluteDenyRule {
  id: string;
  reason: string;
  matches: (action: ToolAction) => boolean;
}

const RECURSIVE_DELETE =
  /\brm\b(?=[^\n]*\s(?:-[a-z]*r|--recursive))(?=[^\n]*\s(?:-[a-z]*f|--force))[^\n]*\s(\/\*|\/|~|\$HOME)(\s|$|\/)/;
const FORK_BOMB = /:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:[^}]*\}\s*;\s*:/;
const PIPE_TO_SHELL = /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/;
const WIPE_DEVICE = /\b(mkfs\b|dd\b[^\n]*\bof=\/dev\/|>\s*\/dev\/(sd|nvme|vd|disk))/;
const SECRET_MARKERS = /(\.ssh\/|id_rsa|id_ed25519|\.aws\/credentials|\/etc\/shadow|\.pem\b)/;

function isForcePush(command: string): boolean {
  if (!/\bgit\b[^\n]*\bpush\b/.test(command)) return false;
  if (/--force-with-lease\b/.test(command)) return false;
  return /--force\b/.test(command) || /\s-f(\s|$)/.test(command);
}

const ABSOLUTE_DENY_RULES: AbsoluteDenyRule[] = [
  {
    id: "recursive-root-delete",
    reason: "recursive delete of a root or home path",
    matches: (action) => Boolean(action.command && RECURSIVE_DELETE.test(action.command)),
  },
  {
    id: "fork-bomb",
    reason: "fork bomb",
    matches: (action) => Boolean(action.command && FORK_BOMB.test(action.command)),
  },
  {
    id: "force-push",
    reason: "force-push (use --force-with-lease instead)",
    matches: (action) => Boolean(action.command && isForcePush(action.command)),
  },
  {
    id: "pipe-network-to-shell",
    reason: "piping a network download straight into a shell",
    matches: (action) => Boolean(action.command && PIPE_TO_SHELL.test(action.command)),
  },
  {
    id: "wipe-device",
    reason: "overwriting a raw block device or filesystem",
    matches: (action) => Boolean(action.command && WIPE_DEVICE.test(action.command)),
  },
  {
    id: "touch-private-keys",
    reason: "reading or writing private keys / credential files",
    matches: (action) =>
      [action.command, action.path].some((value) => value !== undefined && SECRET_MARKERS.test(value)),
  },
];

export function matchAbsoluteDeny(action: ToolAction): AbsoluteDenyRule | undefined {
  return ABSOLUTE_DENY_RULES.find((rule) => rule.matches(action));
}

export function decidePolicy(action: ToolAction, mode: PolicyMode): PolicyVerdict {
  const denied = matchAbsoluteDeny(action);
  if (denied) return { decision: "deny", reason: denied.reason, absolute: true };
  if (action.risk === "read") return { decision: "allow", reason: "read-only", absolute: false };
  if (mode === "auto") return { decision: "allow", reason: "auto mode", absolute: false };
  return { decision: "ask", reason: "a mutating action needs approval", absolute: false };
}
