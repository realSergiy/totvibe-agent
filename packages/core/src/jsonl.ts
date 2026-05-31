import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonlLog {
  private writes: Promise<void> = Promise.resolve();
  private isDirReady = false;

  constructor(private readonly path: string) {}

  append(record: unknown): void {
    const line = `${JSON.stringify(record)}\n`;
    this.writes = this.writes.then(async () => {
      if (!this.isDirReady) {
        await mkdir(dirname(this.path), { recursive: true });
        this.isDirReady = true;
      }
      await appendFile(this.path, line);
    });
  }

  flushed(): Promise<void> {
    return this.writes;
  }

  async readAll(): Promise<unknown[]> {
    let text: string;
    try {
      text = await readFile(this.path, "utf8");
    } catch {
      return [];
    }
    const records: unknown[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      records.push(JSON.parse(line));
    }
    return records;
  }
}

