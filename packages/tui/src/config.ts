import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ProviderKind = "native" | "openai-compatible";

export interface ProviderInfo {
  name: string;
  label: string;
  kind: ProviderKind;
  apiKeyEnv: string;
  defaultModel: string;
  keyUrl: string;
  keyHint: string;
  baseURL?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    name: "anthropic",
    label: "Anthropic Claude",
    kind: "native",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-opus-4-7",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "Anthropic Console → API keys.",
  },
  {
    name: "openai",
    label: "OpenAI",
    kind: "native",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-5.1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "OpenAI dashboard → API keys.",
  },
  {
    name: "qwen",
    label: "Alibaba Qwen",
    kind: "openai-compatible",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    defaultModel: "qwen3.7-max",
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keyUrl: "https://www.alibabacloud.com/help/en/model-studio/get-api-key",
    keyHint: "Alibaba Cloud Model Studio → API keys.",
  },
  {
    name: "glm",
    label: "Z.ai GLM",
    kind: "openai-compatible",
    apiKeyEnv: "ZAI_API_KEY",
    defaultModel: "glm-5.1",
    baseURL: "https://api.z.ai/api/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyHint: "Z.ai → API keys.",
  },
  {
    name: "kimi",
    label: "Moonshot Kimi",
    kind: "openai-compatible",
    apiKeyEnv: "MOONSHOT_API_KEY",
    defaultModel: "kimi-k2.6",
    baseURL: "https://api.moonshot.ai/v1",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    keyHint: "Moonshot / Kimi platform → API keys.",
  },
  {
    name: "mimo",
    label: "Xiaomi MiMo",
    kind: "openai-compatible",
    apiKeyEnv: "MIMO_API_KEY",
    defaultModel: "mimo-v2.5-pro",
    baseURL: "https://api.xiaomimimo.com/v1",
    keyUrl: "https://platform.xiaomimimo.com",
    keyHint: "Xiaomi MiMo platform → API keys.",
  },
  {
    name: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-pro",
    baseURL: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyHint: "DeepSeek platform → API keys.",
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
  sandboxNet: "none" | "inherit";
}

export function findProvider(name: string): ProviderInfo | undefined {
  return PROVIDERS.find((provider) => provider.name === name);
}

export function isConnected(provider: ProviderInfo): boolean {
  return Boolean(process.env[provider.apiKeyEnv]?.trim());
}

export function buildModel(provider: ProviderInfo, modelId: string): LanguageModel {
  if (provider.kind === "native") {
    return provider.name === "openai" ? openai(modelId) : anthropic(modelId);
  }
  const openaiCompatible = createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseURL ?? "",
    apiKey: process.env[provider.apiKeyEnv],
  });
  return openaiCompatible(modelId);
}

export function loadInitialConfig(): InitialConfig {
  const providerName = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
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
    sandboxNet: process.env.TOTVIBE_SANDBOX_NET === "inherit" ? "inherit" : "none",
  };
}
