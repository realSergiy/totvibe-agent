import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { ProviderInfo } from "@totvibe/protocol";

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
      return { ok: false, rejected: true, reason: `rejected (HTTP ${String(response.status)})` };
    }
    if (response.ok) return { ok: true, rejected: false };
    return { ok: false, rejected: false, reason: `HTTP ${String(response.status)}` };
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
