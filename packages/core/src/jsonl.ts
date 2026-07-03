import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type RecordSchema<T> = {
  parse(value: unknown): T;
};

export class JsonlLog {
  private isDirReady = false;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  append(record: unknown) {
    const line = `${JSON.stringify(record)}\n`;
    const previousWrites = this.writes;
    this.writes = (async () => {
      await previousWrites;
      if (!this.isDirReady) {
        await mkdir(path.dirname(this.path), { recursive: true });
        this.isDirReady = true;
      }
      await appendFile(this.path, line);
    })();
  }

  flushed() {
    return this.writes;
  }

  async readAll<T>(schema: RecordSchema<T>) {
    let text: string;
    try {
      text = await readFile(this.path, 'utf8');
    } catch {
      return [];
    }
    const records: T[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      records.push(schema.parse(JSON.parse(line)));
    }
    return records;
  }
}
