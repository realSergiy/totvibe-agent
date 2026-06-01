import { findLatestSessionId, loadSessionMessages } from "@totvibe/core";
import type { ModelMessage } from "ai";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PROVIDER, findProvider, PROVIDERS, type ProviderInfo } from "./registry";

const SYSTEM_PROMPT = `You are totvibe, a minimalist coding assistant running in a terminal.
You operate inside the user's current working directory. Use the tools to read files, list directories, write files, and run shell commands.
Always read before you write. Make the smallest change that satisfies the request, then summarize what you did in one or two sentences.
read_file and list_dir run automatically; write_file and run_bash require the user's approval, so state your intent clearly before calling them.`;

interface AgentLimits {
  maxSteps: number;
  wallClockMs: number;
  tokenBudget: number;
  approvalTimeoutMs: number;
}

interface StorePaths {
  sessionsDir: string;
  auditPath: string;
}

export interface InitialConfig {
  providerName: string;
  modelId: string;
  system: string;
  cwd: string;
  autoApprove: boolean;
  sandbox: boolean;
  sandboxNet: "none" | "inherit";
  limits: AgentLimits;
  paths: StorePaths;
  sessionId: string;
  initialMessages: ModelMessage[];
}

export interface CliOptions {
  sandbox: boolean;
  resume?: string;
  continueLast?: boolean;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildLimits(provider: ProviderInfo): AgentLimits {
  return {
    maxSteps: parsePositiveInt(process.env.TOTVIBE_MAX_STEPS) ?? 24,
    wallClockMs: parsePositiveInt(process.env.TOTVIBE_WALL_CLOCK_MS) ?? 600_000,
    tokenBudget: parsePositiveInt(process.env.TOTVIBE_TOKEN_BUDGET) ?? provider.metadata.contextWindow * 8,
    approvalTimeoutMs: parsePositiveInt(process.env.TOTVIBE_APPROVAL_TIMEOUT_MS) ?? 0,
  };
}

function resolveDataDir(): string {
  return process.env.TOTVIBE_DATA_DIR ?? join(homedir(), ".totvibe");
}

async function resolveSession(
  cli: CliOptions,
  paths: StorePaths,
): Promise<{ sessionId: string; initialMessages: ModelMessage[] }> {
  const requestedId = cli.resume ?? (cli.continueLast ? await findLatestSessionId(paths.sessionsDir) : undefined);
  if (!requestedId) return { sessionId: crypto.randomUUID(), initialMessages: [] };
  const initialMessages = await loadSessionMessages(paths.sessionsDir, requestedId);
  return { sessionId: requestedId, initialMessages };
}

export async function loadInitialConfig(cli: CliOptions): Promise<InitialConfig> {
  const providerName = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER.name).toLowerCase();
  const provider = findProvider(providerName);
  if (!provider) {
    const known = PROVIDERS.map((entry) => entry.name).join(", ");
    throw new Error(`Unknown AI_PROVIDER "${providerName}". Choose one of: ${known}.`);
  }
  const dataDir = resolveDataDir();
  const paths: StorePaths = {
    sessionsDir: join(dataDir, "sessions"),
    auditPath: join(dataDir, "audit.jsonl"),
  };
  const { sessionId, initialMessages } = await resolveSession(cli, paths);
  return {
    providerName,
    modelId: process.env.MODEL ?? provider.defaultModel,
    system: SYSTEM_PROMPT,
    cwd: process.cwd(),
    autoApprove: process.env.AUTO_APPROVE === "1",
    sandbox: cli.sandbox,
    sandboxNet: process.env.TOTVIBE_SANDBOX_NET === "inherit" ? "inherit" : "none",
    limits: buildLimits(provider),
    paths,
    sessionId,
    initialMessages,
  };
}
