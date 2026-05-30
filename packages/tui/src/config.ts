import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { findLatestSessionId, loadSessionMessages } from "@totvibe/core";
import type { LanguageModel, ModelMessage } from "ai";
import { homedir } from "node:os";
import { join } from "node:path";

interface ModelMetadata {
  contextWindow: number;
  maxOutputTokens: number;
  costPerMTokInput: number;
  costPerMTokOutput: number;
  supportsReasoning: boolean;
}

export interface ProviderInfo {
  name: string;
  label: string;
  apiKeyEnv: string;
  defaultModel: string;
  keyUrl: string;
  keyHint: string;
  baseURL: string;
  metadata: ModelMetadata;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    name: "qwen",
    label: "Alibaba Qwen",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    defaultModel: "qwen3.7-max",
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keyUrl: "https://www.alibabacloud.com/help/en/model-studio/get-api-key",
    keyHint: "Alibaba Cloud Model Studio → API keys.",
    metadata: { contextWindow: 262144, maxOutputTokens: 8192, costPerMTokInput: 1.6, costPerMTokOutput: 6.4, supportsReasoning: false },
  },
  {
    name: "glm",
    label: "Z.ai GLM Coding Plan (Global)",
    apiKeyEnv: "ZAI_API_KEY",
    defaultModel: "glm-5.1",
    baseURL: "https://api.z.ai/api/coding/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyHint: "Z.ai → API keys (GLM Coding Plan).",
    metadata: { contextWindow: 204800, maxOutputTokens: 8192, costPerMTokInput: 0.6, costPerMTokOutput: 2.2, supportsReasoning: true },
  },
  {
    name: "glm-cn",
    label: "Zhipu GLM Coding Plan (China)",
    apiKeyEnv: "ZHIPU_API_KEY",
    defaultModel: "glm-5.1",
    baseURL: "https://open.bigmodel.cn/api/coding/paas/v4",
    keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    keyHint: "Zhipu BigModel → API keys (GLM Coding Plan).",
    metadata: { contextWindow: 204800, maxOutputTokens: 8192, costPerMTokInput: 0.6, costPerMTokOutput: 2.2, supportsReasoning: true },
  },
  {
    name: "kimi",
    label: "Moonshot Kimi",
    apiKeyEnv: "MOONSHOT_API_KEY",
    defaultModel: "kimi-k2.6",
    baseURL: "https://api.moonshot.ai/v1",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    keyHint: "Moonshot / Kimi platform → API keys.",
    metadata: { contextWindow: 262144, maxOutputTokens: 8192, costPerMTokInput: 0.6, costPerMTokOutput: 2.5, supportsReasoning: false },
  },
  {
    name: "mimo",
    label: "Xiaomi MiMo",
    apiKeyEnv: "MIMO_API_KEY",
    defaultModel: "mimo-v2.5-pro",
    baseURL: "https://api.xiaomimimo.com/v1",
    keyUrl: "https://platform.xiaomimimo.com",
    keyHint: "Xiaomi MiMo platform → API keys.",
    metadata: { contextWindow: 131072, maxOutputTokens: 8192, costPerMTokInput: 0.3, costPerMTokOutput: 1.2, supportsReasoning: false },
  },
  {
    name: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-pro",
    baseURL: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyHint: "DeepSeek platform → API keys.",
    metadata: { contextWindow: 131072, maxOutputTokens: 8192, costPerMTokInput: 0.5, costPerMTokOutput: 1.5, supportsReasoning: true },
  },
  {
    name: "gemini",
    label: "Google Gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-3.5-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Google AI Studio → API keys.",
    metadata: { contextWindow: 1048576, maxOutputTokens: 65536, costPerMTokInput: 0.3, costPerMTokOutput: 2.5, supportsReasoning: true },
  },
  {
    name: "minimax",
    label: "MiniMax",
    apiKeyEnv: "MINIMAX_API_KEY",
    defaultModel: "minimax-m2.7",
    baseURL: "https://api.minimax.io/v1",
    keyUrl: "https://www.minimax.io/platform/user-center/basic-information/interface-key",
    keyHint: "MiniMax platform → API keys.",
    metadata: { contextWindow: 245760, maxOutputTokens: 8192, costPerMTokInput: 0.3, costPerMTokOutput: 1.2, supportsReasoning: true },
  },
  {
    name: "mistral",
    label: "Mistral AI",
    apiKeyEnv: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-3",
    baseURL: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
    keyHint: "Mistral console → API keys.",
    metadata: { contextWindow: 131072, maxOutputTokens: 8192, costPerMTokInput: 2.0, costPerMTokOutput: 6.0, supportsReasoning: false },
  },
];

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

export function findProvider(name: string): ProviderInfo | undefined {
  return PROVIDERS.find((provider) => provider.name === name);
}

export function isConnected(provider: ProviderInfo): boolean {
  return Boolean(process.env[provider.apiKeyEnv]?.trim());
}

export interface ApiKeyCheck {
  ok: boolean;
  rejected: boolean;
  reason?: string;
}

export async function validateApiKey(
  provider: ProviderInfo,
  apiKey: string,
): Promise<ApiKeyCheck> {
  const url = `${provider.baseURL.replace(/\/+$/, "")}/models`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, rejected: true, reason: `rejected (HTTP ${response.status})` };
    }
    if (response.ok) return { ok: true, rejected: false };
    return { ok: false, rejected: false, reason: `HTTP ${response.status}` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    return { ok: false, rejected: false, reason };
  }
}

export function buildModel(provider: ProviderInfo, modelId: string): LanguageModel {
  const openaiCompatible = createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseURL,
    apiKey: process.env[provider.apiKeyEnv],
  });
  return openaiCompatible(modelId);
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
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

export interface CliOptions {
  sandbox: boolean;
  resume?: string;
  continueLast?: boolean;
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
  const providerName = (process.env.AI_PROVIDER ?? "qwen").toLowerCase();
  const provider = findProvider(providerName);
  if (!provider) {
    const known = PROVIDERS.map((entry) => entry.name).join(", ");
    throw new Error(`Unknown AI_PROVIDER "${providerName}". Choose one of: ${known}.`);
  }
  const root = resolveDataDir();
  const paths: StorePaths = {
    sessionsDir: join(root, "sessions"),
    auditPath: join(root, "audit.jsonl"),
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
