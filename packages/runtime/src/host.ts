import type { ProviderInfo } from "@totvibe/protocol";

import { resolve } from "node:path";

export type RuntimeHost = {
  saveEnvVars(updates: Record<string, string>): Promise<void>;
}

export const isConnected = (provider: ProviderInfo) => Boolean(process.env[provider.apiKeyEnv]?.trim());

export const bunHost: RuntimeHost = {
  saveEnvVars: async (updates: Record<string, string>) => {
    const path = resolve(process.cwd(), ".env");
    const file = Bun.file(path);
    const existing = (await file.exists()) ? await file.text() : "";
    const lines = existing.length > 0 ? existing.split("\n") : [];

    const written = new Set<string>();
    const rewritten = lines.map((line) => {
      const match = /^\s*([A-Za-z0-9_]+)\s*=/.exec(line);
      const name = match?.[1];
      if (name && updates[name] !== undefined) {
        written.add(name);
        return `${name}=${updates[name]}`;
      }
      return line;
    });

    while (rewritten.at(-1)?.trim() === "") rewritten.pop();

    for (const [name, value] of Object.entries(updates)) {
      if (!written.has(name)) rewritten.push(`${name}=${value}`);
      process.env[name] = value;
    }

    await Bun.write(path, `${rewritten.join("\n")}\n`);
  },
};
