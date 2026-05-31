import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ModelMessage } from "./ai-core";
import type { AgentEvent } from "./events";
import { JsonlLog } from "./jsonl";

interface MessageRecord {
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

  readonly persist = (event: AgentEvent): void => {
    if (event.type !== "message") return;
    this.log.append({ message: event.message } satisfies MessageRecord);
  };

  flushed(): Promise<void> {
    return this.log.flushed();
  }
}

function sessionFilePath(dir: string, sessionId: string): string {
  return join(dir, `${sessionId}.jsonl`);
}

export async function loadSessionMessages(dir: string, sessionId: string): Promise<ModelMessage[]> {
  const log = new JsonlLog(sessionFilePath(dir, sessionId));
  const records = (await log.readAll()) as MessageRecord[];
  return records.map((record) => record.message);
}

export async function findLatestSessionId(dir: string): Promise<string | undefined> {
  let entries: Array<{ name: string; fileModTime: number }>;
  try {
    const names = await readdir(dir);
    entries = await Promise.all(
      names
        .filter((name) => name.endsWith(".jsonl"))
        .map(async (name) => {
          const stat = await Bun.file(join(dir, name)).stat();
          return { name: name.slice(0, -".jsonl".length), fileModTime: stat.mtimeMs };
        }),
    );
  } catch {
    return undefined;
  }
  if (entries.length === 0) return undefined;
  return entries.sort((a, b) => b.fileModTime - a.fileModTime)[0]!.name;
}
