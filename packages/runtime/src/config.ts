import type { ModelMessage } from "ai";

import { findLatestSessionId, loadSessionMessages } from "@totvibe/core";
import { DEFAULT_PROVIDER, findProvider, type ProviderInfo, PROVIDERS } from "@totvibe/protocol";
import { homedir } from "node:os";
import { join } from "node:path";

const SYSTEM_PROMPT = `You are totvibe, a minimalist coding assistant running in a terminal.
You operate inside the user's current working directory. Use the tools to read files, list directories, write files, and run shell commands.
Always read before you write. Make the smallest change that satisfies the request, then summarize what you did in one or two sentences.
read_file and list_dir run automatically; write_file and run_bash require the user's approval, so state your intent clearly before calling them.`;

export type CliOptions = {
  continueLast?: boolean;
  resume?: string;
  sandbox: boolean;
}

export type InitialConfig = {
  autoApprove: boolean;
  cwd: string;
  initialMessages: ModelMessage[];
  limits: AgentLimits;
  modelId: string;
  paths: StorePaths;
  providerName: string;
  sandbox: boolean;
  sandboxNet: "inherit" | "none";
  sessionId: string;
  system: string;
}

type AgentLimits = {
  approvalTimeoutMs: number;
  maxSteps: number;
  tokenBudget: number;
  wallClockMs: number;
}

type StorePaths = {
  auditPath: string;
  sessionsDir: string;
}

const parsePositiveInt = (raw: string | undefined) => {
  if (raw === undefined) return;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const buildLimits = (provider: ProviderInfo) => ({
    approvalTimeoutMs: parsePositiveInt(process.env.TOTVIBE_APPROVAL_TIMEOUT_MS) ?? 0,
    maxSteps: parsePositiveInt(process.env.TOTVIBE_MAX_STEPS) ?? 24,
    tokenBudget: parsePositiveInt(process.env.TOTVIBE_TOKEN_BUDGET) ?? provider.metadata.contextWindow * 8,
    wallClockMs: parsePositiveInt(process.env.TOTVIBE_WALL_CLOCK_MS) ?? 600_000,
  });

const resolveDataDir = () => process.env.TOTVIBE_DATA_DIR ?? join(homedir(), ".totvibe");

const resolveSession = async (cli: CliOptions, paths: StorePaths) => {
  const requestedId = cli.resume ?? (cli.continueLast ? await findLatestSessionId(paths.sessionsDir) : undefined);
  if (!requestedId) return { initialMessages: [], sessionId: crypto.randomUUID() };
  const initialMessages = await loadSessionMessages(paths.sessionsDir, requestedId);
  return { initialMessages, sessionId: requestedId };
};

export const loadInitialConfig = async (cli: CliOptions) => {
  const providerName = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER.name).toLowerCase();
  const provider = findProvider(providerName);
  if (!provider) {
    const known = PROVIDERS.map((entry) => entry.name).join(", ");
    throw new Error(`Unknown AI_PROVIDER "${providerName}". Choose one of: ${known}.`);
  }
  const dataDir = resolveDataDir();
  const paths: StorePaths = {
    auditPath: join(dataDir, "audit.jsonl"),
    sessionsDir: join(dataDir, "sessions"),
  };
  const { initialMessages, sessionId } = await resolveSession(cli, paths);
  return {
    autoApprove: process.env.AUTO_APPROVE === "1",
    cwd: process.cwd(),
    initialMessages,
    limits: buildLimits(provider),
    modelId: process.env.MODEL ?? provider.defaultModel,
    paths,
    providerName,
    sandbox: cli.sandbox,
    sandboxNet: process.env.TOTVIBE_SANDBOX_NET === "inherit" ? "inherit" : "none",
    sessionId,
    system: SYSTEM_PROMPT,
  };
};
