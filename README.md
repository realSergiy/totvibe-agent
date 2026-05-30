# totvibe

A minimalist terminal coding assistant — an owned, streaming tool-use loop wrapped in an [OpenTUI](https://opentui.com) TUI, on [Bun](https://bun.com), powered by the [Vercel AI SDK](https://ai-sdk.dev) v6.

## Setup

```bash
bun install
bun run build:sandbox   # optional, Linux only — builds the bash sandbox helper (needs Rust)
```

No key needed up front — the connect dialog (below) walks you through it on first run and saves it to `.env`. To skip the dialog, set a key in `.env` (`cp .env.example .env`).

## Run

```bash
bun start          # or: just totvibe
```

Type a request and press Enter. `read_file` and `list_dir` run automatically; `write_file` and `run_bash` ask for approval (`y` to run, `n` to skip). **Esc** cancels the running turn; **Ctrl+C** quits. The status bar shows the active `provider:model`, connection state, and sandbox status. Each turn is persisted append-only under `~/.totvibe/sessions`; resume with `--continue` (most recent) or `--resume <id>`.

The sandbox is **on by default**, confining everything to the working directory. Pass `--no-sandbox` (e.g. `bun start --no-sandbox` or `just totvibe --no-sandbox`) to run without it; `bun start --help` lists every flag.

### Sandboxing (Linux)

The sandbox is **on by default** — file tools and `run_bash` are confined to the working directory unless you pass `--no-sandbox`. `run_bash` runs each command through a Landlock + namespace sandbox helper (`bun run build:sandbox` to build it). The command — and any process it spawns — can only:

- **read** system dirs (`/usr`, `/bin`, `/etc`, `/proc`, …);
- **read/write** the working directory, `/tmp`, and `/dev`;
- reach the **network** only when `TOTVIBE_SANDBOX_NET=inherit` (default is isolated via a network namespace).

File tools (`read_file`/`write_file`/`list_dir`) are validated against the same allow-list, so they can't touch anything `run_bash` can't either. Grant more access for the session with **`/grant <path>`**.

The helper binary is optional: without it, `run_bash` falls back to an unsandboxed shell (marked `(unsandboxed)` in output) and the status bar shows the degraded state. It needs a Linux kernel ≥ 5.13 (Landlock) and unprivileged user namespaces.

### Connect dialog / model switcher

The dialog opens automatically when no provider has a key, and any time you type **`/provider`** in the input box. It lists every provider with its connection status and selected model:

- **↑ / ↓** — highlight a provider
- **t** — test the connection (probes the provider's `/models` with the stored key) and report OK / key rejected / unreachable
- **o** — open that provider's API-key page in your browser
- **k** — paste an API key, then Enter to verify and save it (checked against the provider's `/models` endpoint; a rejected key keeps you on the field to retry, then it's written to `.env` and applied live)
- **m** — edit the model id, then Enter to switch to it
- **Enter** — use the highlighted provider/model
- **Esc** — close (once a provider is connected)

The status bar reflects real connectivity for the active provider: it probes `/models` on launch and after each change, showing `● ok`, `◌ checking…`, `✗ key rejected`, or `● unreachable`.

## Configuration

Read from the environment (Bun loads `.env` automatically):

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `qwen` | One of the OpenAI-compatible providers below |
| `MODEL` | per provider | Override the model id |
| `<PROVIDER>_API_KEY` | — | Key for the selected provider (see table below) |
| `AUTO_APPROVE` | unset | `1` enables Auto mode: auto-approve mutating tools **except** the absolute-deny list (`rm -rf /`, force-push, …) |
| `TOTVIBE_SANDBOX_NET` | `none` | `inherit` to let sandboxed `run_bash` use the network |
| `TOTVIBE_SANDBOX_BIN` | — | Override the path to the sandbox helper binary |
| `TOTVIBE_MAX_STEPS` | `24` | Hard cap on model steps per turn |
| `TOTVIBE_WALL_CLOCK_MS` | `600000` | Hard wall-clock cap per turn (ms) |
| `TOTVIBE_TOKEN_BUDGET` | ctx × 8 | Hard token cap per turn |
| `TOTVIBE_APPROVAL_TIMEOUT_MS` | `0` | Approval-prompt timeout (`0` = wait indefinitely) |
| `TOTVIBE_DATA_DIR` | `~/.totvibe` | Where sessions + the approval/audit ledger are stored |

Command-line flags (parsed with [citty](https://github.com/unjs/citty)) — run `bun start --help` for the full list:

| Flag | Default | Purpose |
|---|---|---|
| `--no-sandbox` | sandbox on | Start without the filesystem/network sandbox |
| `--resume <id>` | — | Resume a saved session by id (see `~/.totvibe/sessions`) |
| `--continue` | off | Resume the most recently saved session |

## Connecting other provider-models

Easiest path is the connect dialog above (type **`/provider`**) — it opens the key page and saves the key for you. To configure by hand instead: every provider below is OpenAI-compatible (via `@ai-sdk/openai-compatible`) — set `AI_PROVIDER`, its key, and optionally a `MODEL`. No code change needed.

| `AI_PROVIDER` | Model | API key env | Base URL | Get a key |
|---|---|---|---|---|
| `qwen` | Alibaba `qwen3.7-max` | `DASHSCOPE_API_KEY` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | [Model Studio](https://www.alibabacloud.com/help/en/model-studio/get-api-key) |
| `glm` | Z.ai `glm-5.1` (GLM Coding Plan, Global) | `ZAI_API_KEY` | `https://api.z.ai/api/coding/paas/v4` | [Z.ai](https://z.ai/manage-apikey/apikey-list) |
| `glm-cn` | Zhipu `glm-5.1` (GLM Coding Plan, China) | `ZHIPU_API_KEY` | `https://open.bigmodel.cn/api/coding/paas/v4` | [Zhipu BigModel](https://open.bigmodel.cn/usercenter/apikeys) |
| `kimi` | Moonshot `kimi-k2.6` | `MOONSHOT_API_KEY` | `https://api.moonshot.ai/v1` | [Kimi platform](https://platform.moonshot.ai/console/api-keys) |
| `mimo` | Xiaomi `mimo-v2.5-pro` | `MIMO_API_KEY` | `https://api.xiaomimimo.com/v1` | [MiMo platform](https://platform.xiaomimimo.com) |
| `deepseek` | DeepSeek `deepseek-v4-pro` | `DEEPSEEK_API_KEY` | `https://api.deepseek.com/v1` | [DeepSeek platform](https://platform.deepseek.com/api_keys) |
| `gemini` | Google `gemini-3.5-flash` | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `minimax` | MiniMax `minimax-m2.7` | `MINIMAX_API_KEY` | `https://api.minimax.io/v1` | [MiniMax platform](https://www.minimax.io/platform/user-center/basic-information/interface-key) |
| `mistral` | Mistral `mistral-large-3` | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | [Mistral console](https://console.mistral.ai/api-keys) |

The model id in the table is the default for that provider; override it with `MODEL` to match the provider's current catalog. Example — DeepSeek:

```bash
AI_PROVIDER=deepseek DEEPSEEK_API_KEY=sk-... MODEL=deepseek-v4-pro bun start
```

Or in `.env`:

```bash
AI_PROVIDER=qwen
DASHSCOPE_API_KEY=sk-...
# MODEL=qwen3.7-max
```

To add another OpenAI-compatible provider, append one entry (including its model metadata) to the `PROVIDERS` registry in `packages/tui/src/config.ts`.

## Architecture

A Bun workspaces monorepo. Each package is one architectural concern, so each can evolve without touching the others.

*How a request flows through the packages, and where the extension seams (tools, policy middleware, persistence) plug in.*

```mermaid
flowchart TD
    subgraph tui["@totvibe/tui · view"]
      direction TB
      Input["InputBar"]
      Reducer["reducer → AppState"]
      Render["box / scrollbox / text"]
      Input --> Reducer --> Render
    end
    subgraph core["@totvibe/core · engine"]
      direction TB
      Loop["runAgent · owned loop"]
      Stream["streamText · one model turn"]
      Dispatch["runToolCalls<br/>reads parallel · writes serial"]
      Bus["EventBus"]
      Store["SessionStore · JSONL"]
      Loop --> Stream
      Loop --> Dispatch
      Loop --> Bus
      Bus -->|"message → persist"| Store
    end
    subgraph safety["@totvibe/safety · policy"]
      Gate["policyGate<br/>deny → mode → allow → ask"]
      Ledger["AuditLedger · JSONL"]
    end
    subgraph tools["@totvibe/tools · values"]
      Builtins["read_file · list_dir<br/>write_file"]
      Bash["run_bash"]
    end
    subgraph sandbox["@totvibe/sandbox · isolation"]
      Helper["Landlock + netns helper"]
    end

    Input -->|"user text"| Loop
    Bus -->|"AgentEvent"| Reducer
    Dispatch --> Gate
    Gate -->|"read → allow · mutate → ask"| Builtins
    Gate -->|"mutate → ask"| Bash
    Gate -->|"decision → ledger"| Ledger
    Bash -->|"spawn per call"| Helper
    Gate -.->|"approval y/n"| Render
```

| Package | Owns | Extend by |
|---|---|---|
| `@totvibe/core` | The owned `runAgent` loop, the `AgentEvent` union + `EventBus`, the append-only `SessionStore` (JSONL, resume-by-id), the value-typed tool registry, and `compose` for middleware | Adding event kinds; subscribing to the event stream; wrapping the loop in a reasoning strategy |
| `@totvibe/tools` | The built-in tool *values* (`defineTool`), with token-capped output | Adding a tool — return it from `createBuiltinTools` |
| `@totvibe/safety` | The policy engine (`policyGate`: precedence deny→mode→allow→ask + absolute-deny) and the append-only `AuditLedger` | Composing more middleware (e.g. a classifier) before the executor |
| `@totvibe/sandbox` | The `SandboxState` allow-list + Rust Landlock/namespace helper for `run_bash` | New default paths; per-tool network policy; another OS backend |
| `@totvibe/tui` | The OpenTUI React view + entry + provider config | New components; the view only subscribes to events, it never drives the loop |

The loop is provider-agnostic: the model is injected, so swapping `qwen3.7-max` for another model or provider is a config change, not a code change.

See [`docs/`](./docs) for the full design and phased extension plan.
