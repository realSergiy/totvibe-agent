import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export interface ProviderInfo {
  name: string;
  label: string;
  apiKeyEnv: string;
  defaultModel: string;
  keyUrl: string;
  keyHint: string;
  baseURL: string;
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
  },
  {
    name: "glm",
    label: "Z.ai GLM Coding Plan (Global)",
    apiKeyEnv: "ZAI_API_KEY",
    defaultModel: "glm-5.1",
    baseURL: "https://api.z.ai/api/coding/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyHint: "Z.ai → API keys (GLM Coding Plan).",
  },
  {
    name: "glm-cn",
    label: "Zhipu GLM Coding Plan (China)",
    apiKeyEnv: "ZHIPU_API_KEY",
    defaultModel: "glm-5.1",
    baseURL: "https://open.bigmodel.cn/api/coding/paas/v4",
    keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    keyHint: "Zhipu BigModel → API keys (GLM Coding Plan).",
  },
  {
    name: "kimi",
    label: "Moonshot Kimi",
    apiKeyEnv: "MOONSHOT_API_KEY",
    defaultModel: "kimi-k2.6",
    baseURL: "https://api.moonshot.ai/v1",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    keyHint: "Moonshot / Kimi platform → API keys.",
  },
  {
    name: "mimo",
    label: "Xiaomi MiMo",
    apiKeyEnv: "MIMO_API_KEY",
    defaultModel: "mimo-v2.5-pro",
    baseURL: "https://api.xiaomimimo.com/v1",
    keyUrl: "https://platform.xiaomimimo.com",
    keyHint: "Xiaomi MiMo platform → API keys.",
  },
  {
    name: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-pro",
    baseURL: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyHint: "DeepSeek platform → API keys.",
  },
  {
    name: "gemini",
    label: "Google Gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-3.5-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Google AI Studio → API keys.",
  },
  {
    name: "minimax",
    label: "MiniMax",
    apiKeyEnv: "MINIMAX_API_KEY",
    defaultModel: "minimax-m2.7",
    baseURL: "https://api.minimax.io/v1",
    keyUrl: "https://www.minimax.io/platform/user-center/basic-information/interface-key",
    keyHint: "MiniMax platform → API keys.",
  },
  {
    name: "mistral",
    label: "Mistral AI",
    apiKeyEnv: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-3",
    baseURL: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
    keyHint: "Mistral console → API keys.",
  },
];

export const SYSTEM_PROMPT = `You are totvibe, a minimalist coding assistant running in a terminal.
You operate inside the user's current working directory. Use the tools to read files, list directories, write files, and run shell commands.
Always read before you write. Make the smallest change that satisfies the request, then summarize what you did in one or two sentences.
read_file and list_dir run automatically; write_file and run_bash require the user's approval, so state your intent clearly before calling them.`;

export interface InitialConfig {
  providerName: string;
  modelId: string;
  system: string;
  cwd: string;
  autoApprove: boolean;
  sandbox: boolean;
  sandboxNet: "none" | "inherit";
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

export interface CliOptions {
  sandbox: boolean;
}

export function loadInitialConfig(cli: CliOptions): InitialConfig {
  const providerName = (process.env.AI_PROVIDER ?? "qwen").toLowerCase();
  const provider = findProvider(providerName);
  if (!provider) {
    const known = PROVIDERS.map((entry) => entry.name).join(", ");
    throw new Error(`Unknown AI_PROVIDER "${providerName}". Choose one of: ${known}.`);
  }
  return {
    providerName,
    modelId: process.env.MODEL ?? provider.defaultModel,
    system: SYSTEM_PROMPT,
    cwd: process.cwd(),
    autoApprove: process.env.AUTO_APPROVE === "1",
    sandbox: cli.sandbox,
    sandboxNet: process.env.TOTVIBE_SANDBOX_NET === "inherit" ? "inherit" : "none",
  };
}
