import { defineTool, type AnyToolDefinition } from "@totvibe/core";
import { runSandboxedBash, type NetPolicy, type SandboxState } from "@totvibe/sandbox";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { z } from "zod";

export interface ToolOptions {
  net?: NetPolicy;
  sandbox?: boolean;
}

export function createBuiltinTools(sandbox: SandboxState, options: ToolOptions = {}): AnyToolDefinition[] {
  const net: NetPolicy = options.net ?? "none";
  const sandboxEnabled = options.sandbox ?? true;

  const resolveInSandbox = (cwd: string, path: string): string => {
    const target = resolve(cwd, path);
    if (sandboxEnabled && !sandbox.allowsWrite(target)) {
      throw new Error(`Path outside the sandbox's writable dirs: ${path}. Ask the user to /grant it.`);
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
      const file = Bun.file(resolveInSandbox(cwd, path));
      if (!(await file.exists())) throw new Error(`No such file: ${path}`);
      return await file.text();
    },
  });

  const listDir = defineTool({
    name: "list_dir",
    description: "List the entries of a directory inside the sandbox.",
    risk: "read",
    inputSchema: z.object({
      path: z.string().default(".").describe("Directory path relative to the working directory"),
    }),
    execute: async ({ path }, { cwd }) => {
      const entries = await readdir(resolveInSandbox(cwd, path), { withFileTypes: true });
      const names = entries
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .sort();
      return names.join("\n") || "(empty)";
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
      await Bun.write(resolveInSandbox(cwd, path), content);
      return `Wrote ${content.length} bytes to ${path}`;
    },
  });

  const runBash = defineTool({
    name: "run_bash",
    description: "Run a shell command in a Landlock+namespace sandbox and return its combined output.",
    risk: "mutate",
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
    }),
    execute: async ({ command }, { cwd, signal }) => {
      const result = await runSandboxedBash(command, sandbox, cwd, net, signal, sandboxEnabled);
      const body = [result.stdout, result.stderr].filter(Boolean).join("\n").trimEnd();
      const tag = result.sandboxed ? "" : " (unsandboxed)";
      return `exit ${result.exitCode}${tag}\n${body}`.trimEnd();
    },
  });

  return [readFile, listDir, writeFile, runBash];
}
