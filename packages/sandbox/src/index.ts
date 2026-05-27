import { resolve } from "node:path";

export type NetPolicy = "none" | "inherit";

const DEFAULT_READONLY = [
  "/usr",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/etc",
  "/opt",
  "/proc",
  "/sys",
];
const DEFAULT_READWRITE = ["/dev", "/tmp"];

export class SandboxState {
  private readwrite: Set<string>;
  private readonlyPaths: Set<string>;

  constructor(cwd: string) {
    this.readwrite = new Set([resolve(cwd), ...DEFAULT_READWRITE]);
    this.readonlyPaths = new Set(DEFAULT_READONLY);
  }

  grantReadWrite(path: string): void {
    this.readwrite.add(resolve(path));
  }

  grantReadOnly(path: string): void {
    this.readonlyPaths.add(resolve(path));
  }

  get readwriteDirs(): string[] {
    return [...this.readwrite];
  }

  get readonlyDirs(): string[] {
    return [...this.readonlyPaths];
  }

  allowsWrite(path: string): boolean {
    const target = resolve(path);
    return this.readwriteDirs.some((dir) => target === dir || target.startsWith(`${dir}/`));
  }

  toEnv(net: NetPolicy): Record<string, string> {
    return {
      SANDBOX_RO_PATHS: this.readonlyDirs.join(":"),
      SANDBOX_RW_PATHS: this.readwriteDirs.join(":"),
      SANDBOX_NET: net,
    };
  }
}

export function helperPath(): string {
  return process.env.TOTVIBE_SANDBOX_BIN ?? resolve(import.meta.dir, "..", "bin", "totvibe-sandbox");
}

export interface SandboxStatus {
  available: boolean;
  landlock: boolean;
  net: NetPolicy;
  degraded: boolean;
}

export async function probeSandbox(net: NetPolicy): Promise<SandboxStatus> {
  const binary = helperPath();
  if (!(await Bun.file(binary).exists())) {
    return { available: false, landlock: false, net, degraded: true };
  }
  const probe = Bun.spawn([binary, "--probe"], { stdout: "pipe", stderr: "ignore" });
  const output = await new Response(probe.stdout).text();
  await probe.exited;
  const landlock = output.includes("landlock=ok");
  return { available: true, landlock, net, degraded: !landlock };
}

export interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  sandboxed: boolean;
}

export async function runSandboxedBash(
  command: string,
  state: SandboxState,
  cwd: string,
  net: NetPolicy,
  signal?: AbortSignal,
): Promise<BashResult> {
  const binary = helperPath();
  const sandboxed = await Bun.file(binary).exists();
  const child = sandboxed
    ? Bun.spawn([binary, command], {
        cwd,
        env: { ...process.env, ...state.toEnv(net) },
        stdout: "pipe",
        stderr: "pipe",
        signal,
      })
    : Bun.spawn(["bash", "-c", command], { cwd, stdout: "pipe", stderr: "pipe", signal });

  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const exitCode = await child.exited;
  return { stdout, stderr, exitCode, sandboxed };
}
