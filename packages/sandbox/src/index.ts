import { resolve } from "node:path";

export type NetPolicy = "inherit" | "none";

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

export type BashResult = {
  exitCode: number;
  sandboxed: boolean;
  stderr: string;
  stdout: string;
}

export type SandboxStatus = {
  available: boolean;
  degraded: boolean;
  enabled: boolean;
  hasLandlock: boolean;
  net: NetPolicy;
}

export class SandboxState {
  get readOnlyDirs() {
    return [...this.readOnlyPaths];
  }
  get readWriteDirs() {
    return [...this.readWritePaths];
  }

  private readOnlyPaths: Set<string>;

  private readWritePaths: Set<string>;

  constructor(cwd: string) {
    this.readWritePaths = new Set([resolve(cwd), ...DEFAULT_READWRITE]);
    this.readOnlyPaths = new Set(DEFAULT_READONLY);
  }

  allowsWrite(path: string) {
    const target = resolve(path);
    return this.readWriteDirs.some((dir) => target === dir || target.startsWith(`${dir}/`));
  }

  grantReadOnly(path: string) {
    this.readOnlyPaths.add(resolve(path));
  }

  grantReadWrite(path: string) {
    this.readWritePaths.add(resolve(path));
  }

  toEnv(net: NetPolicy) {
    return {
      SANDBOX_NET: net,
      SANDBOX_RO_PATHS: this.readOnlyDirs.join(":"),
      SANDBOX_RW_PATHS: this.readWriteDirs.join(":"),
    };
  }
}

export const helperPath = () => process.env.TOTVIBE_SANDBOX_BIN ?? resolve(import.meta.dir, "..", "bin", "totvibe-sandbox");

export const probeSandbox = async (net: NetPolicy, enabled = true) => {
  if (!enabled) {
    return { available: false, degraded: false, enabled: false, hasLandlock: false, net };
  }
  const binary = helperPath();
  if (!(await Bun.file(binary).exists())) {
    return { available: false, degraded: true, enabled: true, hasLandlock: false, net };
  }
  const probe = Bun.spawn([binary, "--probe"], { stderr: "ignore", stdout: "pipe" });
  const output = await new Response(probe.stdout).text();
  await probe.exited;
  const hasLandlock = output.includes("landlock=ok");
  return { available: true, degraded: !hasLandlock, enabled: true, hasLandlock, net };
};

export const runSandboxedBash = async (command: string, state: SandboxState, cwd: string, net: NetPolicy, signal?: AbortSignal, enabled = true) => {
  const binary = helperPath();
  const sandboxed = enabled && (await Bun.file(binary).exists());
  const child = sandboxed
    ? Bun.spawn([binary, command], {
        cwd,
        env: { ...process.env, ...state.toEnv(net) },
        signal,
        stderr: "pipe",
        stdout: "pipe",
      })
    : Bun.spawn(["bash", "-c", command], { cwd, signal, stderr: "pipe", stdout: "pipe" });

  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const exitCode = await child.exited;
  return { exitCode, sandboxed, stderr, stdout };
};
