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

export function findProvider(name: string): ProviderInfo | undefined {
  return PROVIDERS.find((provider) => provider.name === name);
}

export function isConnected(provider: ProviderInfo): boolean {
  return Boolean(process.env[provider.apiKeyEnv]?.trim());
}
