import type { ProviderInfo } from '@totvibe/protocol';
import type { LanguageModel } from 'ai';

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type ApiKeyCheck = {
  ok: boolean;
  reason?: string;
  rejected: boolean;
};

const asLanguageModel = (model: LanguageModel) => model;

export const buildModel = (provider: ProviderInfo, modelId: string) => {
  const openaiCompatible = createOpenAICompatible({
    apiKey: process.env[provider.apiKeyEnv],
    baseURL: provider.baseURL,
    name: provider.name,
  });
  return asLanguageModel(openaiCompatible(modelId));
};

export const validateApiKey = async (provider: ProviderInfo, apiKey: string) => {
  const url = `${provider.baseURL.replace(/\/+$/, '')}/models`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: `rejected (HTTP ${String(response.status)})`, rejected: true };
    }
    if (response.ok) return { ok: true, rejected: false };
    return { ok: false, reason: `HTTP ${String(response.status)}`, rejected: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network error';
    return { ok: false, reason, rejected: false };
  }
};
