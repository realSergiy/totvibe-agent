import { defineTool, type AnyToolDef } from "@totvibe/core";
import {
  runSandboxedBash,
  type NetPolicy,
  type SandboxState,
} from "@totvibe/sandbox";
import { realpath } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";

export interface ToolOptions {
  net?: NetPolicy;
  sandbox?: boolean;
}

const OUTPUT_CHAR_CAP = 100_000;
let spillCounter = 0;

async function capOutput(text: string, label: string): Promise<string> {
  if (text.length <= OUTPUT_CHAR_CAP) return text;
  spillCounter += 1;
  const spillPath = join(
    tmpdir(),
    "totvibe",
    `${label}-${String(process.pid)}-${String(spillCounter)}.txt`,
  );
  await Bun.write(spillPath, text);
  const head = text.slice(0, OUTPUT_CHAR_CAP);
  return `${head}\n\n[output truncated: showed ${String(OUTPUT_CHAR_CAP)} of ${String(text.length)} chars; full output saved to ${spillPath} — read_file it if you need the rest]`;
}

async function canonicalizePath(target: string): Promise<string> {
  const tail: string[] = [];
  let current = target;
  for (;;) {
    try {
      const real = await realpath(current);
      return tail.length > 0 ? join(real, ...tail) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return target;
      tail.unshift(basename(current));
      current = parent;
    }
  }
}

export function createBuiltinTools(
  sandbox: SandboxState,
  options: ToolOptions = {},
): AnyToolDef[] {
  const net: NetPolicy = options.net ?? "none";
  const sandboxEnabled = options.sandbox ?? true;

  const resolveInSandbox = async (
    cwd: string,
    path: string,
  ): Promise<string> => {
    const target = resolve(cwd, path);
    if (!sandboxEnabled) return target;
    if (!sandbox.allowsWrite(target)) {
      throw new Error(
        `Path outside the sandbox's writable dirs: ${path}. Ask the user to /grant it.`,
      );
    }
    const canonical = await canonicalizePath(target);
    if (!sandbox.allowsWrite(canonical)) {
      throw new Error(
        `Path escapes the sandbox via a symlink: ${path}. Ask the user to /grant it.`,
      );
    }
    return target;
  };

  const readFile = defineTool({
    name: "read_file",
    description: "Read a UTF-8 text file inside the sandbox.",
    risk: "read",
    inputSchema: z.object({
      path: z.string().describe("File path relative to the working directory"),
    }),
    execute: async ({ path }, { cwd }) => {
      const file = Bun.file(await resolveInSandbox(cwd, path));
      if (!(await file.exists())) throw new Error(`No such file: ${path}`);
      return await capOutput(await file.text(), "read_file");
    },
  });

  const listDir = defineTool({
    name: "list_dir",
    description: "List the entries of a directory inside the sandbox.",
    risk: "read",
    inputSchema: z.object({
      path: z
        .string()
        .default(".")
        .describe("Directory path relative to the working directory"),
    }),
    execute: async ({ path }, { cwd }) => {
      const entries = await readdir(await resolveInSandbox(cwd, path), {
        withFileTypes: true,
      });
      const names = entries
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .sort();
      return await capOutput(names.join("\n") || "(empty)", "list_dir");
    },
  });

  const writeFile = defineTool({
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file inside the sandbox.",
    risk: "mutate",
    inputSchema: z.object({
      path: z.string().describe("File path relative to the working directory"),
      content: z.string().describe("Full contents to write"),
    }),
    execute: async ({ path, content }, { cwd }) => {
      await Bun.write(await resolveInSandbox(cwd, path), content);
      return `Wrote ${String(content.length)} bytes to ${path}`;
    },
  });

  const runBash = defineTool({
    name: "run_bash",
    description:
      "Run a shell command in a Landlock+namespace sandbox and return its combined output.",
    risk: "mutate",
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
    }),
    execute: async ({ command }, { cwd, signal }) => {
      const result = await runSandboxedBash(
        command,
        sandbox,
        cwd,
        net,
        signal,
        sandboxEnabled,
      );
      const body = [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .trimEnd();
      const tag = result.sandboxed ? "" : " (unsandboxed)";
      return await capOutput(
        `exit ${String(result.exitCode)}${tag}\n${body}`.trimEnd(),
        "run_bash",
      );
    },
  });

  return [readFile, listDir, writeFile, runBash];
}

