import type { ProviderInfo } from '@totvibe/protocol';

import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';

export type ApiKeyCheck = {
  ok: boolean;
  reason?: string;
  rejected: boolean;
};

export const buildModel = (
  { apiKeyEnv, baseURL, name }: ProviderInfo,
  modelId: string,
): ReturnType<OpenAICompatibleProvider['languageModel']> => {
  const openaiCompatible = createOpenAICompatible({
    apiKey: process.env[apiKeyEnv],
    baseURL: baseURL,
    name: name,
  });
  return openaiCompatible(modelId);
};

const API_KEY_CHECK_TIMEOUT_MS = 15_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

export const validateApiKey = async ({ baseURL }: ProviderInfo, apiKey: string) => {
  const url = `${baseURL.replace(/\/+$/, '')}/models`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(API_KEY_CHECK_TIMEOUT_MS),
    });
    if (response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN) {
      return { ok: false, reason: `rejected (HTTP ${String(response.status)})`, rejected: true };
    }
    if (response.ok) return { ok: true, rejected: false };
    return { ok: false, reason: `HTTP ${String(response.status)}`, rejected: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network error';
    return { ok: false, reason, rejected: false };
  }
};
