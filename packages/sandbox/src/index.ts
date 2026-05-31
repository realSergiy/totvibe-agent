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
  private readWritePaths: Set<string>;
  private readOnlyPaths: Set<string>;

  constructor(cwd: string) {
    this.readWritePaths = new Set([resolve(cwd), ...DEFAULT_READWRITE]);
    this.readOnlyPaths = new Set(DEFAULT_READONLY);
  }

  grantReadWrite(path: string): void {
    this.readWritePaths.add(resolve(path));
  }

  grantReadOnly(path: string): void {
    this.readOnlyPaths.add(resolve(path));
  }

  get readWriteDirs(): string[] {
    return [...this.readWritePaths];
  }

  get readOnlyDirs(): string[] {
    return [...this.readOnlyPaths];
  }

  allowsWrite(path: string): boolean {
    const target = resolve(path);
    return this.readWriteDirs.some((dir) => target === dir || target.startsWith(`${dir}/`));
  }

  toEnv(net: NetPolicy): Record<string, string> {
    return {
      SANDBOX_RO_PATHS: this.readOnlyDirs.join(":"),
      SANDBOX_RW_PATHS: this.readWriteDirs.join(":"),
      SANDBOX_NET: net,
    };
  }
}

export function helperPath(): string {
  return process.env.TOTVIBE_SANDBOX_BIN ?? resolve(import.meta.dir, "..", "bin", "totvibe-sandbox");
}

export interface SandboxStatus {
  enabled: boolean;
  available: boolean;
  hasLandlock: boolean;
  net: NetPolicy;
  degraded: boolean;
}

export async function probeSandbox(net: NetPolicy, enabled = true): Promise<SandboxStatus> {
  if (!enabled) {
    return { enabled: false, available: false, hasLandlock: false, net, degraded: false };
  }
  const binary = helperPath();
  if (!(await Bun.file(binary).exists())) {
    return { enabled: true, available: false, hasLandlock: false, net, degraded: true };
  }
  const probe = Bun.spawn([binary, "--probe"], { stdout: "pipe", stderr: "ignore" });
  const output = await new Response(probe.stdout).text();
  await probe.exited;
  const hasLandlock = output.includes("landlock=ok");
  return { enabled: true, available: true, hasLandlock, net, degraded: !hasLandlock };
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
  enabled = true,
): Promise<BashResult> {
  const binary = helperPath();
  const sandboxed = enabled && (await Bun.file(binary).exists());
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
