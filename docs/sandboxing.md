# Implementing Landlock Sandboxing for a Bun-Based Coding Agent

## Pre-Flight: Reality Check on Your Preferred Options

Before the guide, let me be honest about the tools you listed, because this shapes the whole approach:

**The `landlock` npm package by mscdex** — I'd want to verify what's actually published before recommending it. npm has a `landlock` package, but it's been around since the early Landlock days when only ABI v1 (filesystem) existed. You'd need to check: does it expose ABI v4+ (which you need for network restrictions)? Does it expose `landlock_restrict_self` in a way usable from a forked child *after* `unshare`? Many Node-native Landlock wrappers assume "call from main thread, done" — which is fine for self-restricting a server, but wrong for your fork-per-bash pattern. **Verify before depending on it.** If it works for ABI v4 and post-fork use, great, take it. If not, skip.

**Rust** is an excellent fit. The `landlock` crate (the official one, maintained by Landlock contributors) is mature, exposes the full ABI, and compiles to a tiny static binary. Cross-compilation to musl gives you a ~500KB helper with zero runtime dependencies. This is what I'd actually recommend.

**Python** is a poor fit for this. You'd need `python-landlock` bindings (exist but niche), and you'd be shipping a Python interpreter to run a 50-line helper. Skip.

**Zig** works well technically — direct syscalls, tiny binary, no runtime — but the Landlock ecosystem is thinner. You'd be writing the syscall wrappers yourself against `linux/landlock.h`. Fine if you already know Zig; otherwise the Rust crate saves you a day.

**C** is the lowest-friction option for the helper itself (it's ~150 lines), but you give up memory safety and ergonomics for something that handles security-critical paths.

**My recommendation: Rust helper.** I'll write the guide around that, with notes for the npm-package path if it pans out.

## Architecture

Three pieces:

The **outer CLI** (`cool-agent`) is your existing Bun-compiled binary. It parses flags, sets up config, and exec's the agent. It does *not* sandbox itself — it has network access to call the Anthropic API and read the user's environment.

The **agent process** is your Bun TypeScript code. Also unsandboxed. It holds the allowed-directories list, runs the TUI, makes API calls, and validates file paths in TypeScript for read/edit tools. For bash tool calls, it spawns the helper.

The **sandbox helper** (`cool-agent-sandbox`, Rust binary) is invoked once per bash call. It receives the allowed-dirs list and the command via argv/env, performs `unshare` for network isolation, applies Landlock rules, then exec's `bash -c "..."`. After exec, bash inherits all restrictions and cannot escape.

Why a separate helper rather than doing it in-process via FFI? Because `landlock_restrict_self` and `unshare(CLONE_NEWNET)` affect the calling process irreversibly. You don't want your long-lived agent's bash subprocess to inherit anything weird, and you definitely don't want to fork the agent and have the child still holding Bun runtime state. A clean exec barrier is simpler and safer.

## Step 1: The Rust Helper

Create a separate crate. I'll show the structure rather than every line, since you'll want to read the `landlock` crate docs alongside.

```text
cool-agent-sandbox/
  Cargo.toml
  src/main.rs
```

`Cargo.toml`:

```toml
[package]
name = "cool-agent-sandbox"
version = "0.1.0"
edition = "2021"

[dependencies]
landlock = "0.4"
nix = { version = "0.29", features = ["sched", "process", "user"] }
anyhow = "1"

[profile.release]
opt-level = "z"
lto = true
strip = true
codegen-units = 1
panic = "abort"
```

The helper's job, in order:

First, parse arguments. Convention: read allowed read-only paths from `$SANDBOX_RO_PATHS` (colon-separated), read-write paths from `$SANDBOX_RW_PATHS`, network policy from `$SANDBOX_NET` (`none` or `inherit`), and the command from argv. Environment variables avoid argv length limits and quoting hell.

Second, unshare namespaces. Use `nix::sched::unshare` with `CLONE_NEWUSER | CLONE_NEWNET` when network is `none`. The user namespace is required to get unprivileged net namespace creation. After unsharing, write `deny` to `/proc/self/setgroups`, then map your uid/gid in `/proc/self/uid_map` and `gid_map` (single-line `0 <real_uid> 1`). This is standard rootless-namespace setup.

Third, apply Landlock. Using the `landlock` crate:

```rust
use landlock::{
    Access, AccessFs, PathBeneath, PathFd, Ruleset, RulesetAttr,
    RulesetCreatedAttr, ABI,
};

let abi = ABI::V4;  // or latest your kernel supports
let mut ruleset = Ruleset::default()
    .handle_access(AccessFs::from_all(abi))?
    .create()?;

for path in ro_paths {
    ruleset = ruleset.add_rule(
        PathBeneath::new(PathFd::new(&path)?, AccessFs::from_read(abi))
    )?;
}

for path in rw_paths {
    ruleset = ruleset.add_rule(
        PathBeneath::new(PathFd::new(&path)?, AccessFs::from_all(abi))
    )?;
}

ruleset.restrict_self()?;
```

Fourth, exec bash:

```rust
use nix::unistd::execvp;
use std::ffi::CString;

let bash = CString::new("/bin/bash")?;
let dash_c = CString::new("-c")?;
let cmd = CString::new(command_string)?;
execvp(&bash, &[bash.clone(), dash_c, cmd])?;
```

After `execvp`, bash runs with all restrictions inherited. It cannot un-unshare, cannot un-Landlock, cannot reach the network, cannot write outside the rw paths.

Build it: `cargo build --release --target x86_64-unknown-linux-musl`. Musl gives you a fully static binary that runs on any Linux. The result is ~500KB-1MB.

## Step 2: Integrating with Your Bun Agent

In your agent's bash tool implementation, replace direct `Bun.spawn(["bash", "-c", cmd])` with a call to the helper. Something like:

```typescript
import { spawn } from "bun";
import { resolve } from "node:path";

interface SandboxConfig {
  readonlyPaths: string[];
  readwritePaths: string[];
  allowNetwork: boolean;
}

async function runSandboxedBash(
  command: string,
  config: SandboxConfig,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const helper = resolve(import.meta.dir, "../bin/cool-agent-sandbox");

  const proc = spawn({
    cmd: [helper, command],
    cwd,
    env: {
      ...process.env,
      SANDBOX_RO_PATHS: config.readonlyPaths.join(":"),
      SANDBOX_RW_PATHS: config.readwritePaths.join(":"),
      SANDBOX_NET: config.allowNetwork ? "inherit" : "none",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}
```

The agent maintains the mutable allowed-dirs list:

```typescript
class SandboxState {
  private readwriteDirs = new Set<string>();
  private readonlyDirs = new Set<string>([
    "/usr", "/bin", "/lib", "/lib64", "/etc",
  ]);

  constructor(initialPwd: string) {
    this.readwriteDirs.add(resolve(initialPwd));
  }

  grantReadWrite(path: string) {
    this.readwriteDirs.add(resolve(path));
  }

  grantReadOnly(path: string) {
    this.readonlyDirs.add(resolve(path));
  }

  toConfig(allowNetwork: boolean): SandboxConfig {
    return {
      readonlyPaths: [...this.readonlyDirs],
      readwritePaths: [...this.readwriteDirs],
      allowNetwork,
    };
  }
}
```

When the user grants a new directory mid-session (via a `/grant <path>` slash command, say), you call `sandboxState.grantReadWrite(path)`, and the next bash invocation picks it up automatically. This is the dynamic-directory benefit of the fork-per-bash pattern.

For file read/edit tools that live in your TypeScript code, validate against the same state:

```typescript
function validatePathForWrite(path: string, state: SandboxState): string {
  const resolved = resolve(path);
  const allowed = state.getReadWriteDirs().some(
    dir => resolved === dir || resolved.startsWith(dir + "/")
  );
  if (!allowed) throw new Error(`Path outside sandbox: ${resolved}`);
  return resolved;
}
```

Belt-and-suspenders: your TS code refuses writes outside allowed dirs, *and* even if it had a bug, the helper-spawned bash couldn't write there either.

## Step 3: Packaging Both Binaries Together

You want one user-installable thing. Bun's `bun build --compile` produces a single executable for your agent. Ship that plus the Rust helper as two files, with an install script that drops both into `~/.local/bin`:

```text
cool-agent-1.0.0-linux-x64.tar.gz
├── cool-agent              (Bun-compiled, ~50MB)
└── cool-agent-sandbox      (Rust static binary, ~1MB)
```

Your agent finds the helper at a known location relative to itself (`import.meta.dir + "/../bin/cool-agent-sandbox"` if installed via standard layout, or alongside the binary). If you want true single-file distribution, you can embed the helper in your Bun binary via `Bun.file` + `--asset` (Bun's embedded files feature) and extract to a temp directory on first run. Slightly more complex; not necessary for v1.

For the outer wrapper behavior — `cool-agent --sandbox-pwd` — that's purely a flag your Bun agent reads at startup. It doesn't re-exec itself or anything; it just initializes `SandboxState` with pwd as the only read-write directory. The "wrapping" you mentioned in earlier turns isn't needed with this architecture: the agent itself stays unsandboxed (it needs API access), only its bash children get sandboxed.

## Step 4: Kernel Version Handling

Landlock ABI versions matter:

- ABI v1 (Linux 5.13, June 2021): basic filesystem
- ABI v2 (5.19): refer-to operations
- ABI v3 (6.2): truncate
- ABI v4 (6.7): TCP network bind/connect
- ABI v5 (6.10): IOCTL on devices
- ABI v6 (6.12): scoped abstract unix sockets, scoped signals

The `landlock` crate's "best-effort" mode handles this gracefully: request ABI v4, fall back to whatever the running kernel supports, and log what you got. You probably don't need network restrictions via Landlock since you're using `unshare(CLONE_NEWNET)` anyway — the net namespace works on any kernel from 2013-ish.

On startup, have your agent probe Landlock support once:

```typescript
const probe = spawn({
  cmd: [helperPath, "--probe"],
  stdout: "pipe",
});
const result = await new Response(probe.stdout).text();
```

Have the helper print the detected ABI version and exit. If Landlock isn't supported at all (very old kernel, or disabled in kconfig), warn the user that sandboxing is degraded — you'll still have the unshare-based network/mount isolation, but filesystem restrictions become advisory (relying only on your TS path validation).

## Step 5: Testing It

Three tests worth running before you trust this:

The escape test: in the sandboxed bash, try `echo pwned > /etc/test`, `ls /home/otheruser`, `curl https://example.com`, `cat /root/.ssh/id_rsa`. All should fail with permission denied or network unreachable.

The dynamic-grant test: start agent with pwd only, run a bash command that writes a file (succeeds), try to write to `/tmp/foo` (fails), grant `/tmp` via slash command, try again (succeeds).

The shell-escape test: try the classics — `bash -c 'bash -c "echo hi > /etc/test"'`, `nohup`, `disown`, backgrounding with `&`. All children inherit the sandbox; none can escape. (This is the key property — Landlock and namespaces are inherited across fork/exec by design.)

## A Note on the npm Package Path

If you check `npm view landlock` and the package supports the ABI versions and post-fork use you need, the architecture stays identical except the helper becomes a tiny Bun script:

```typescript
#!/usr/bin/env bun
import { applyLandlock } from "landlock";
// ... unshare via FFI or a small C shim ...
applyLandlock({ ro: roPaths, rw: rwPaths });
Bun.spawn(["bash", "-c", command], { stdio: "inherit" });
```

The catch: you still need `unshare` for network isolation (the npm package likely doesn't cover that), so you'd FFI into libc for `unshare()` and the uid_map dance. At that point you're writing roughly the same amount of unsafe-ish code as the Rust helper, but in TypeScript with FFI, which is harder to reason about. **Even if the npm package works, I'd still lean Rust** for this specific case.

## Summary of the Build Order

Build the Rust helper first and test it standalone with `SANDBOX_RW_PATHS=/tmp/test ./cool-agent-sandbox 'echo hi > /tmp/test/foo'` — verify the escape tests fail. Then wire it into your agent's bash tool. Then add the `SandboxState` class and slash commands for dynamic grants. Then add the ABI probe and graceful degradation. Then package both binaries together.

The total new code is small: ~150 lines of Rust, ~100 lines of TypeScript glue, plus whatever UI you want for grant commands. The bulk of your existing agent doesn't change.
