import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { ModelMessage } from "./ai-core";
import type { AgentEvent } from "./events";

import { JsonlLog } from "./jsonl";

type MessageRecord = {
  message: ModelMessage;
}

export class SessionStore {
  private readonly log: JsonlLog;

  constructor(
    private readonly dir: string,
    private readonly sessionId: string,
  ) {
    this.log = new JsonlLog(sessionFilePath(dir, sessionId));
  }

  flushed() {
    return this.log.flushed();
  }

  readonly persist = (event: AgentEvent) => {
    if (event.type !== "message") return;
    this.log.append({ message: event.message } satisfies MessageRecord);
  };
}

const sessionFilePath = (dir: string, sessionId: string) => join(dir, `${sessionId}.jsonl`);

export const loadSessionMessages = async (dir: string, sessionId: string) => {
  const log = new JsonlLog(sessionFilePath(dir, sessionId));
  const records = (await log.readAll()) as MessageRecord[];
  return records.map((record) => record.message);
};

export const findLatestSessionId = async (dir: string) => {
  let entries: { fileModTime: number; name: string; }[];
  try {
    const names = await readdir(dir);
    entries = await Promise.all(
      names
        .filter((name) => name.endsWith(".jsonl"))
        .map(async (name) => {
          const stat = await Bun.file(join(dir, name)).stat();
          return { fileModTime: stat.mtimeMs, name: name.slice(0, -".jsonl".length) };
        }),
    );
  } catch {
    return;
  }
  const [latest] = entries.sort((a, b) => b.fileModTime - a.fileModTime);
  return latest?.name;
};
