export type ProviderInfo = {
  apiKeyEnv: string;
  baseURL: string;
  defaultModel: string;
  keyHint: string;
  keyUrl: string;
  label: string;
  metadata: ModelMetadata;
  name: string;
};

type ModelMetadata = {
  contextWindow: number;
  costPerMTokInput: number;
  costPerMTokOutput: number;
  maxOutputTokens: number;
  supportsReasoning: boolean;
};

export const DEFAULT_PROVIDER: ProviderInfo = {
  apiKeyEnv: 'ZAI_API_KEY',
  baseURL: 'https://api.z.ai/api/coding/paas/v4',
  defaultModel: 'glm-5.1',
  keyHint: 'Z.ai → API keys (GLM Coding Plan).',
  keyUrl: 'https://z.ai/manage-apikey/apikey-list',
  label: 'Z.ai GLM Coding Plan (Global)',
  metadata: {
    contextWindow: 204_800,
    costPerMTokInput: 0.6,
    costPerMTokOutput: 2.2,
    maxOutputTokens: 8192,
    supportsReasoning: true,
  },
  name: 'glm',
};

export const PROVIDERS: ProviderInfo[] = [
  DEFAULT_PROVIDER,
  {
    apiKeyEnv: 'ZHIPU_API_KEY',
    baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
    defaultModel: 'glm-5.1',
    keyHint: 'Zhipu BigModel → API keys (GLM Coding Plan).',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    label: 'Zhipu GLM Coding Plan (China)',
    metadata: {
      contextWindow: 204_800,
      costPerMTokInput: 0.6,
      costPerMTokOutput: 2.2,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
    name: 'glm-cn',
  },
  {
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen3.7-max',
    keyHint: 'Alibaba Cloud Model Studio → API keys.',
    keyUrl: 'https://www.alibabacloud.com/help/en/model-studio/get-api-key',
    label: 'Alibaba Qwen',
    metadata: {
      contextWindow: 262_144,
      costPerMTokInput: 1.6,
      costPerMTokOutput: 6.4,
      maxOutputTokens: 8192,
      supportsReasoning: false,
    },
    name: 'qwen',
  },
  {
    apiKeyEnv: 'MOONSHOT_API_KEY',
    baseURL: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2.6',
    keyHint: 'Moonshot / Kimi platform → API keys.',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
    label: 'Moonshot Kimi',
    metadata: {
      contextWindow: 262_144,
      costPerMTokInput: 0.6,
      costPerMTokOutput: 2.5,
      maxOutputTokens: 8192,
      supportsReasoning: false,
    },
    name: 'kimi',
  },
  {
    apiKeyEnv: 'MIMO_API_KEY',
    baseURL: 'https://api.xiaomimimo.com/v1',
    defaultModel: 'mimo-v2.5-pro',
    keyHint: 'Xiaomi MiMo platform → API keys.',
    keyUrl: 'https://platform.xiaomimimo.com',
    label: 'Xiaomi MiMo',
    metadata: {
      contextWindow: 131_072,
      costPerMTokInput: 0.3,
      costPerMTokOutput: 1.2,
      maxOutputTokens: 8192,
      supportsReasoning: false,
    },
    name: 'mimo',
  },
  {
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-pro',
    keyHint: 'DeepSeek platform → API keys.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    label: 'DeepSeek',
    metadata: {
      contextWindow: 131_072,
      costPerMTokInput: 0.5,
      costPerMTokOutput: 1.5,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
    name: 'deepseek',
  },
  {
    apiKeyEnv: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.5-flash',
    keyHint: 'Google AI Studio → API keys.',
    keyUrl: 'https://aistudio.google.com/apikey',
    label: 'Google Gemini',
    metadata: {
      contextWindow: 1_048_576,
      costPerMTokInput: 0.3,
      costPerMTokOutput: 2.5,
      maxOutputTokens: 65_536,
      supportsReasoning: true,
    },
    name: 'gemini',
  },
  {
    apiKeyEnv: 'MINIMAX_API_KEY',
    baseURL: 'https://api.minimax.io/v1',
    defaultModel: 'minimax-m2.7',
    keyHint: 'MiniMax platform → API keys.',
    keyUrl: 'https://www.minimax.io/platform/user-center/basic-information/interface-key',
    label: 'MiniMax',
    metadata: {
      contextWindow: 245_760,
      costPerMTokInput: 0.3,
      costPerMTokOutput: 1.2,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
    name: 'minimax',
  },
  {
    apiKeyEnv: 'MISTRAL_API_KEY',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-3',
    keyHint: 'Mistral console → API keys.',
    keyUrl: 'https://console.mistral.ai/api-keys',
    label: 'Mistral AI',
    metadata: {
      contextWindow: 131_072,
      costPerMTokInput: 2,
      costPerMTokOutput: 6,
      maxOutputTokens: 8192,
      supportsReasoning: false,
    },
    name: 'mistral',
  },
];

export const findProvider = (name: string) => PROVIDERS.find(provider => provider.name === name);
