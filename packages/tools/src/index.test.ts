import { test, expect } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SandboxState } from "@totvibe/sandbox";
import type { AnyToolDefinition } from "@totvibe/core";
import { createBuiltinTools } from "./index";

function pick(tools: AnyToolDefinition[], name: string): AnyToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

async function withSandboxDir<T>(run: (dir: string, tools: AnyToolDefinition[]) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "totvibe-tools-"));
  try {
    const tools = createBuiltinTools(new SandboxState(dir), { sandbox: true });
    return await run(dir, tools);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("read, write, and list happy paths inside the sandbox", async () => {
  await withSandboxDir(async (dir, tools) => {
    const context = { cwd: dir };
    await pick(tools, "write_file").execute({ path: "a.txt", content: "hello" }, context);
    expect(await pick(tools, "read_file").execute({ path: "a.txt" }, context)).toBe("hello");
    expect(await pick(tools, "list_dir").execute({ path: "." }, context)).toContain("a.txt");
  });
});

test("absolute paths outside the sandbox are rejected", async () => {
  await withSandboxDir(async (dir, tools) => {
    expect(pick(tools, "read_file").execute({ path: "/etc/hosts" }, { cwd: dir })).rejects.toThrow(
      /outside the sandbox/,
    );
  });
});

test("a symlink that escapes the sandbox is rejected", async () => {
  await withSandboxDir(async (dir, tools) => {
    await symlink("/etc/hosts", join(dir, "link.txt"));
    expect(pick(tools, "read_file").execute({ path: "link.txt" }, { cwd: dir })).rejects.toThrow(/symlink/);
  });
});

test("oversized output is truncated and spilled to a file", async () => {
  await withSandboxDir(async (dir, tools) => {
    const context = { cwd: dir };
    const big = "x".repeat(120_000);
    await writeFile(join(dir, "big.txt"), big);
    const output = await pick(tools, "read_file").execute({ path: "big.txt" }, context);
    expect(output.length).toBeLessThan(big.length);
    expect(output).toContain("output truncated");
    expect(output).toContain("full output saved to");
  });
});
