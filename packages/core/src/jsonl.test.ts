import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlLog } from "./jsonl";

test("JsonlLog appends records and reads them back in order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "totvibe-jsonl-"));
  try {
    const log = new JsonlLog(join(dir, "nested", "log.jsonl"));
    log.append({ n: 1 });
    log.append({ n: 2 });
    await log.flushed();
    expect(await log.readAll()).toEqual([{ n: 1 }, { n: 2 }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readAll returns empty for a missing file", async () => {
  const log = new JsonlLog(join(tmpdir(), `totvibe-missing-${process.pid}.jsonl`));
  expect(await log.readAll()).toEqual([]);
});
