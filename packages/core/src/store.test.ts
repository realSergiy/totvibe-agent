import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLatestSessionId, loadSessionMessages, SessionStore } from "./store";

test("SessionStore persists message events and resumes them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "totvibe-store-"));
  try {
    const store = new SessionStore(dir, "s1");
    store.persist({ type: "turn_start" });
    store.persist({ type: "message", message: { role: "user", content: "hi" } });
    store.persist({ type: "message", message: { role: "assistant", content: "yo" } });
    store.persist({ type: "text", text: "streamed, not persisted" });
    await store.flushed();

    expect(await loadSessionMessages(dir, "s1")).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "yo" },
    ]);
    expect(await findLatestSessionId(dir)).toBe("s1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadSessionMessages is empty for an unknown session", async () => {
  const dir = await mkdtemp(join(tmpdir(), "totvibe-store-"));
  try {
    expect(await loadSessionMessages(dir, "nope")).toEqual([]);
    expect(await findLatestSessionId(dir)).toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
