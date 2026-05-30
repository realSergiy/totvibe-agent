# Coding Agent Architecture: Pitfalls & Rulebook

**An architectural deep-dive and actionable rulebook for building an extensible, enterprise-grade AI coding agent.**

Target system assumed throughout: a **skills + CLI-based** coding agent that deliberately treats **MCP as secondary, not primary**, must support an **Auto / "yolo" (autonomous) mode**, and must stay maintainable as it scales from a startup MVP to an enterprise product.

---

## 0. How to read this document

- **§1 Methodology** — what was analyzed and how findings were verified.
- **§2 Reference architecture** — the layered shape to build toward.
- **§3 How the 7 agents are built** — a comparison matrix + a grounded capsule per agent (core loop, tool execution, state, extensibility), with `file:line` citations, plus a **§3.3 deep-dive on the Claude Code core** (3 month old repo).
- **§4 Patterns to adopt** and **§5 Anti-patterns to avoid** — cross-cutting lessons grounded in the code and the literature.
- **§6 Research-grounded principles** — the academic / industry evidence base, with sources.
- **§7 The Rulebook** — the centerpiece: categorized, absolute **Do's and Don'ts**.
- **§8 A pragmatic build sequence** — what to build day 1 vs. later.
- **§9 Sources.**

If you read only one section, read **§7**. If you read two, add **§2**.

---

## 1. Methodology & evidence base

This document is grounded in two evidence streams, deliberately cross-checked against each other:

1. **Production source analysis** of seven open-source coding agents, read directly (git history stripped) at `/work/{aider, claude-code, hermes-agent, kilocode, openclaw, opencode, pi}`. Every architectural claim about an agent is tied to a `path:line` citation in its real source.
2. **Literature & industry research** across five themes: academic tool-use (ReAct, CodeAct, SWE-agent, Voyager, Reflexion…), planning frameworks, reasoning frameworks, industry engineering blogs / post-mortems, and Auto/yolo-mode + sandboxing (incl. Anthropic's Auto mode and sandboxing posts). 60 sourced findings underpin §6–§7.

**Verification pass.** The load-bearing factual claims (17 of them) were independently re-checked against the source by adversarial verifier agents. Result: **11 confirmed, 6 corrected for precision, 0 refuted** — i.e. no claim was hallucinated, but several were sharpened. The corrections are folded into this document and flagged with **⚠︎ Corrected** where they change a recommendation. The two most consequential:

- Hermes does **not** share one iteration budget across its sub-agent tree (a common misreading); sub-agents get **independent** budgets, so total spend can **exceed** the parent cap. The *shared-global-budget* idea is still the right design — Hermes just doesn't fully implement it. (See §3 Hermes, §5.)
- openclaw's `net-policy` package is an **SSRF IP-classifier + URL-redactor**, **not** an OS-level network-egress sandbox. The egress-allowlist pattern is real and recommended, but its evidence is Anthropic's sandboxing work, not openclaw's library. (See §4 pattern 11, §7 Autonomy.)

**⚠︎ Provenance note on `claude-code` (updated).** This analysis was first written against the *public plugins/SDK/docs* repo (core closed). The `claude-code` directory has since been **replaced with a source of the Claude Code CLI core** (TypeScript, ~1,900 files / 512K+ LOC, Bun + React/Ink + `@anthropic-ai/sdk` + MCP; `package.json` version `0.0.0-leaked`, dated 2026-03-31). Three independent read-throughs rate it **strongly consistent with genuine de-bundled source** — `bun:bundle` `feature()` gates, GrowthBook flags, `ant-only` code branches, React-compiler markers, and internally coherent cross-module architecture that a mock would not sustain. **However**, it is a third-party republish (an npm "explorer" package + a `backup` branch advertised as the "original unmodified" source), so the working tree **may contain republisher modifications**, and we have not cryptographically verified it. We therefore treat its findings as **illustrative of a mature, production-grade design — grounded in real files with `path:line` citations — but provenance-unverified**, and we do not treat any single detail as authoritative Anthropic behavior. §3.3 is a dedicated deep-dive; the public-plugin-contract findings (SKILL.md frontmatter, hook events, marketplace, managed settings) remain valid and are corroborated by the core source.

---

## 2. The reference architecture

Every reliable agent in this study converges on the same skeleton, and the literature ("an agent is just a while-loop with tools") agrees. Build toward these layers, with **events and typed contracts between them and no layer reaching into another's internals**:

```text
            ┌─────────────────────────────────────────────────────────────┐
 Frontends  │   CLI    │    TUI    │   IDE host   │   Web / Gateway / API   │   (many, swappable)
            └───────────────────────────────┬─────────────────────────────┘
                              subscribe ▲    │ commands
                                        │    ▼
            ┌─────────────────────  EVENT BUS / STREAM  ───────────────────┐   (typed events:
            │   message_start/delta/end · tool_call · tool_result · turn_end │    UI, logging,
            └───────────────────────────────┬─────────────────────────────┘    audit subscribe)
                                             │
            ┌───────────────────────  CORE LOOP (thin)  ───────────────────┐
            │  call model → append → run tool calls → append results → loop │   (you own control
            │  hard caps: max steps · wall-clock · token budget             │    flow; replayable)
            └───┬───────────────┬───────────────┬───────────────┬──────────┘
                │               │               │               │
      ┌─────────▼────┐ ┌────────▼───────┐ ┌─────▼────────┐ ┌────▼──────────────┐
      │ TOOL + SKILL │ │ POLICY / PERM. │ │  CONTEXT     │ │ PROVIDER ADAPTERS │
      │ REGISTRY     │ │ ENGINE         │ │  ENGINE      │ │ (stream fn +      │
      │ (1 contract, │ │ hooks→deny→    │ │ budget,      │ │  metadata, in a   │
      │  glob/import │ │ mode→allow→ask │ │ compaction,  │ │  registry)        │
      │  discovery)  │ │ deny absolute  │ │ skills load  │ └───────────────────┘
      └──────┬───────┘ └───────┬────────┘ └──────┬───────┘
             │                 │                 │
      ┌──────▼─────────────────▼─────────────────▼───────────────────────────┐
      │  EXECUTION SANDBOX  (OS sandbox + out-of-process egress proxy)         │
      │  + DURABLE STATE STORE (append-only messages in SQLite/JSONL)          │
      │  + SHADOW-GIT CHECKPOINTS  (rollback, per-task worktree)               │
      └───────────────────────────────────────────────────────────────────────┘
```

The **non-negotiable seams** — the ones whose absence the studied agents pay for repeatedly — are: (a) **engine ⟂ frontend** (so the loop can run headless for Auto mode and host many UIs), (b) **every state write emits an event** (so persistence/UI/audit are subscribers), (c) **every tool call passes one policy engine** (so autonomy is safe), and (d) **the provider SDK is never called from the loop** (so model churn is isolated).

---

## 3. How the 7 agents are built

### 3.1 Comparison matrix

| Agent | Lang | Core loop | Tool model | State / persistence | Context strategy | Extensibility | Standout strength | Biggest risk |
|---|---|---|---|---|---|---|---|---|
| **aider** | Python | Single-threaded `while True: coder.run()`; per-message **generator** that streams → parses fenced edits → applies → auto-lint/test/commit; reflection capped at 3 | **Not tool-call based.** Edits = subclassed `Coder` formats (EditBlock/Whole/Patch/UDiff) parsed from markdown; slash-commands; shell confirmed per-command | **Git commits are the system of record** (auto-commit per edit; `/undo` resets HEAD); transcripts in-memory + optional disk file | RepoMap (tree-sitter AST + PageRank, ~1k tokens, diskcache); in-chat files verbatim; background summarizer | **Rigid** — new format = new subclass+prompt class; no plugin/skill API; fork to extend | Verification-gated reflection loop + git auto-commit = clean recoverability | Interactive-only; shell in repo root, **no sandbox**; fragile regex edit-parsing |
| **claude-code** ⚠︎*leaked core; provenance unverified* | TS (Bun + React/Ink) | `query()`→`queryLoop()` nested **async generators**; streams model output, dispatches tools inline; `Terminal\|Continue` transition enum; token-budget auto-continue; `maxTurns` cap | `Tool.ts`: Zod `inputSchema` + `isReadOnly`/`isConcurrencySafe`/`isDestructive` + `checkPermissions`(allow/deny/ask) + async-gen `call`; orchestrator **batches read-only tools parallel (≤10), serializes writes**; pre/post tool hooks; MCP + sub-agents-as-tools | **JSONL transcripts** (lockfile, per-project); Zustand-style `AppStateStore`; migrations; resume by session id | **3-layer compaction**: auto-compact (full summarize at window−buffer, 3-fail circuit-breaker) / micro-compact (time-based + cached `cache_edits`) / session-memory extraction; `memdir` long-term memory; prompt-cache-break detection | **Richest**: skills (SKILL.md progressive disclosure + conditional/dynamic/bundled), plugins (manifest+builtin), **4 hook types** (command/prompt/http/agent) × ~14 events, slash-command union, output styles, MCP, subagents | Most complete reference: async-gen loop + read-only-parallel orchestration + 3-layer compaction + memory + layered permission/**Auto-mode classifier** + multi-agent teammates/coordinator | Enormous surface (512K LOC); worktree isolation is **cwd-only** (not env/net sandbox); compaction circuit-breaker can leave context pressure unrelieved; permission deny doesn't hard-stop (relies on `maxTurns`); ⚠︎ provenance unverified |
| **hermes-agent** | Python | Turn-driven; `run_conversation()` is **one ~4.3–4.7k-line function**; per-turn `iteration_budget.consume()`; parallel tools via ThreadPool (≤8) | Import-time **registry** (schema+handler+`check_fn`, TTL-cached 30 s); MCP opt-in gateway; `approval.py` gates dangerous ops | **SQLite-first**: WAL (DELETE fallback on NFS), **FTS5** full-text search; batch flush per turn; cached system prompt restored from DB | `context_compressor.py` (~2.1k LOC) aux-model summarization on preflight token estimate **or** 4xx context-full; cached prefix for cache stability | 3 surfaces: tools (import+register), config-driven plugins (lifecycle hooks), MCP (opt-in); no inheritance | FTS5-searchable durable state; multi-provider; `check_fn` availability gating | **God-modules** (`auxiliary_client` ~5.6k LOC); 6+ provider adapters fragment parity; no RBAC; ⚠︎ sub-agents get **independent** budgets → can exceed cap |
| **kilocode** | TS (VS Code ext. + vendored opencode engine) | Event-driven (Effect/Stream): `processor.handleEvent()` consumes LLM stream, updates DB parts, publishes to bus; **doom-loop detect** (3 identical calls) | **Skills-first CLI** (glob-scanned SKILL.md) + **MCP deliberately secondary** (`convertMcpTool`); shell tool uses **tree-sitter AST** to classify commands for gating | Session = source of truth in **Drizzle ORM** (append-only `PartTable`); `snapshot.track()` captures FS pre-LLM | `usable() = contextWindow − 20k`; `isOverflow()` → compaction anchored to prior summary, keeps recent ~25% | Skills (SKILL.md), agents (`.md` modes), MCP via config, `ToolDefinition` iface; **Effect DI** throughout | Effect-based DI; cascading permission ruleset merge w/ read-only hardening; `--auto` descendant-only | ⚠︎ **~1,951 `kilocode_change` markers across 246 files** in vendored opencode (fork-merge hell); VS Code coupling; **no permission timeout** → CLI hangs |
| **openclaw** | TS (monorepo) | `agent-loop.ts`: outer follow-up queue + inner steering/tool loop; tools **prepared then `Promise.all`** (parallel default); `shouldStopAfterTurn` terminates; immutable turn snapshots | `AgentTool` w/ **TypeBox** schema; `prepare`(validate+`beforeToolCall` gate) → `execute`(progress) → `afterToolCall`; per-tool `executionMode` | `Agent` owns mutable state w/ copy-on-assign; immutable `AgentState` view; session = JSONL or memory backend | `transformContext()` hook (prune/inject/compact) → `convertToLlm()`; branch-summarization | **Package/export seams**; `plugin-sdk`; `registerApiProvider`; ⚠︎ **7 optional loop hooks** (1 required: `convertToLlm`) | Clean hook-based extension points; `Result`-type error algebra; prepared-execution permission gate | **Global mutable** provider registry (no per-agent isolation); event-ordering ambiguity in parallel mode; model fallback **outside** the loop |
| **opencode** | Go (standalone) | `internal/llm/agent/agent.go`: session/message-driven loop; provider streaming; **permission-gated** tool exec; **tools run sequentially** (no intra-turn parallelism); LSP integration | Go **`BaseTool` interface** (`Info()`/`Run()`); registry in code; `agent-tool.go` = **sub-agent-as-tool**; `mcp-tools.go` bridge; bash = **persistent shell** w/ banned-command list + read-only allowlist for permissionless reads | **SQLite via `internal/db`** (sqlc-generated `sessions.sql.go`/`messages.sql.go`); **`pubsub.Broker` publishes Created/Updated/Deleted on every write**; in-memory permissions (cleared on restart) | History in DB; **manual** `Summarize` → `SummaryMessageID` checkpoint (not automatic); LSP context; `internal/diff` | **Compiled** — tools registered in code; provider adapters in `internal/llm`; config-driven; **no runtime plugin/skill loading** | Cleanest **DB+pubsub decoupling** (every write emits an event); **sqlc** type-safe SQL; LSP; permission engine as its own module | Go binary = recompile to add a tool; sequential tools; **manual** compaction (no auto-checkpoint); in-memory permissions; tool registry frozen at bootstrap |
| **pi** | TS (monorepo: agent/ai/coding-agent/tui) | `agent-loop.ts` (sibling of openclaw): nested follow-up/steering loop; per-tool `executionMode` (`:382`), `Promise.all` default (`:502`), `beforeToolCall`(`:581`)/`afterToolCall`(`:676`); errors encoded in final message (never thrown) | `AgentTool` (prepare→gate→execute→finalize); **no built-in permission system** (apps gate via `beforeToolCall`); bash takes **pluggable `BashOperations`** (route to SSH/Docker/sandbox); skills = passive **SKILL.md** loaded recursively (`:138`, `disable-model-invocation` `:275`) | **Immutable session tree** (append-only entries + parent pointers → branch/fork); JSONL or memory backend; `migrations.ts` | `harness/compaction` (threshold + LLM summary); `skills.ts` recursive discovery; `system-prompt.ts` injects visible skills as XML | **Cleanest engine/frontend/provider split** (agent ⟂ ai ⟂ coding-agent ⟂ tui); first-class **modes**: interactive / print / **RPC (headless JSON)**; `registerApiProvider`/`unregisterApiProviders(sourceId)`; extension SDK (tools/commands/UI hooks) | SKILL.md-native; built-in **RPC/headless** mode for autonomy; clean package boundaries; immutable branchable session | ⚠︎ provider registry **identical to openclaw** (both process-global; pi is *not* better-isolated); hook-proliferation/event-ordering risks; full-array message copy on every mutation; less battle-tested |

### 3.2 Per-agent capsules (grounded)

**aider — the edit-format / git-native interactive agent.**
Core loop is a single-threaded `while True: coder.run()` (`aider/main.py:1159–1181`) that swaps edit-format/model via a `SwitchCoder` exception; per-message work is a generator pipeline `run()→run_one()→send_message()` (`coders/base_coder.py:876–944`) that streams chunks, parses edits, applies, then auto-lints/tests/commits, with reflection capped at `max_reflections=3` (`base_coder.py:101`, `:939`). It is **not tool-call based** (`base_coder.py:96 functions=None`): each edit format is a `Coder` subclass overriding `get_edits()/apply_edits()` parsing fenced markdown (`coders/editblock_coder.py:21–41`), and a successful edit **auto-commits to git** as the system of record (`base_coder.py:1585`, `:2375–2395`). Shell commands run via `subprocess` with `shell=True` in the repo root behind only a confirmation gate — **no sandbox** (`base_coder.py:2456–2475`, `run_cmd.py:62–73`). *Lesson: the verification-gated reflection loop + git-as-undo is excellent; the interactive-only assumptions and unsandboxed shell are exactly what a yolo-capable agent must not inherit.*

**claude-code — the most complete reference (⚠︎ from purported leaked core; provenance unverified).** The directory now holds a de-bundled TS core, so this is grounded in real modules rather than inferred from the plugin repo. The loop is a **nested async generator** `query()`→`queryLoop()` (`src/query.ts:219–251`, `while(true)` at `:307`) that streams the model response and dispatches tools inline, with an explicit `Terminal | Continue` transition enum (`src/query/transitions.ts`) covering `completed/max_turns/prompt_too_long/stop_hook_prevented/...` vs `tool_use/max_output_tokens_recovery/token_budget_continuation/...`. The **tool contract** (`src/Tool.ts:362–549`) is the cleanest in the study: a Zod `inputSchema`, `isReadOnly()`/`isConcurrencySafe()`/`isDestructive()` predicates, an async-generator `call()`, and `checkPermissions()→allow|deny|ask`; the orchestrator **partitions calls and runs read-only tools in parallel batches (≤10) while serializing writes** (`src/services/tools/toolOrchestration.ts:91–177`) — the concrete mechanism the other agents lack. State is JSONL transcripts with lockfile coordination (`src/history.ts:115–149`) over a Zustand-style store (`src/state/AppStateStore.ts`). Context management is a **three-layer compaction subsystem** (`src/services/compact/`): auto-compact (full summarize at `contextWindow − buffer`, with a 3-failure circuit breaker), micro-compact (time-based tool-result clearing + a *cached* path using API `cache_edits` so the prefix cache survives), and background session-memory extraction — plus a `memdir/` long-term memory store retrieved per-query. Permissions/autonomy are a layered engine (`src/types/permissions.ts`, `src/hooks/useCanUseTool.tsx`): precedence **deny → allow → mode → classifier → ask**, modes `default/acceptEdits/bypassPermissions/dontAsk/plan` (+ ant-only `auto`), a remote killswitch that downgrades bypass, a **2-stage Auto-mode classifier** (`src/utils/permissions/yoloClassifier.ts`, fast tool_use stage → thinking stage) with a circuit breaker and denial tracking, plan-mode → semantic-permission handoff, and **cwd-only worktree isolation** (`EnterWorktreeTool` — notably not env/network sandboxing). See **§3.3** for the full grounded breakdown. *Lesson: this is the closest blueprint to the target system — copy the read-only-parallel tool orchestration, the 3-layer compaction, the layered permission precedence with absolute deny + classifier, and progressive-disclosure skills; but note its honest gaps (worktree ≠ sandbox; permission deny relies on `maxTurns` to actually stop a persistent model; 512K-LOC surface is a maintenance reality).*

**hermes-agent — feature-dense Python, cautionary on sprawl.** The whole loop is `run_conversation()`, a single **~4.3–4.7k-line function** (`agent/conversation_loop.py:351–4703`); sibling modules are similarly huge (`auxiliary_client.py` ~5.6k LOC). State is **SQLite-first**: WAL with a DELETE fallback for NFS/SMB/FUSE and **FTS5** full-text search over messages (`hermes_state.py:54–57, 148–196, 299–321`). Tools self-register at import with `schema+handler+check_fn`, `check_fn` TTL-cached ~30 s, and **MCP is an opt-in secondary** namespace excluded from builtin discovery (`tools/registry.py:121–141`, `model_tools.py:180–193`). Context compression (`context_compressor.py` ~2.1k LOC) fires on preflight token estimate **or** a provider 4xx context-full error. ⚠︎ *Corrected:* the often-cited "shared IterationBudget across parent and sub-agents" is wrong — `delegate_tool.py:1136` spawns each sub-agent with `iteration_budget=None` → a **fresh** budget, and the docstring states total iterations across parent+sub-agents can **exceed** the parent cap (`iteration_budget.py:20–24`). *Lesson: the durable searchable SQLite store and import-time registry are worth copying; the 4.7k-line loop, 6 bespoke provider god-files, and per-sub-agent budgets that blow past the cap are the maintainability/cost traps to design out.*

**kilocode — VS Code agent rebuilt on a vendored opencode engine.** The real agent now lives in a **vendored `packages/opencode`** engine (skills, permissions, compaction) plus a `kilo-vscode` UI. The loop is event-driven over Effect Streams (`packages/opencode/src/session/processor.ts`), with doom-loop detection on 3 identical calls (`processor.ts:427–450`). Skills are the primary CLI surface (`skill/index.ts:29–31` globbing SKILL.md) and **MCP is deliberately secondary** (`mcp/index.ts:146 convertMcpTool`, added after registry tools in `session/prompt.ts:434–477`); the shell tool uses **tree-sitter AST** to classify commands for permission gating (`tool/shell.ts:326–439`). Permissions use a cascading `Permission.merge/resolve` ruleset with read-only hardening, and `--auto` approves only descendant sessions (`kilocode/cli/run-auto.ts`). ⚠︎ *Corrected:* the fork burden is **~1,951 `kilocode_change` markers across 246 files** (not ~246 comments) — confirmed by `AGENTS.md:76–78`. Other documented gotchas: `Permission.ask()` blocks on a `Deferred` with **no timeout** (`permission/index.ts:290–298`) so the CLI can hang, and compaction only protects `['skill']` tool output, dropping write/edit/read records. *Lesson: skills-primary + MCP-secondary + AST-gated shell + cascading read-only-hardened permissions are exactly right; embedding an engine into one frontend via inline fork markers, and a human-gate with no timeout, are what not to do.*

**openclaw — clean package seams, global-registry footgun.** `packages/agent-core/src/agent-loop.ts` runs an outer follow-up queue + inner steering/tool loop; tools are **prepared then executed via `Promise.all`** (parallel default) with a per-tool `executionMode` override, and `beforeToolCall`/`afterToolCall` gates wrap execution; the LLM layer is split `llm-core` (contracts) vs `llm-runtime` (providers). ⚠︎ *Corrected (C17):* there are **7 optional loop hooks** plus one **required** `convertToLlm` (`types.ts:162–281`), and error handling is inconsistent (tool hooks have call-site try/catch, loop hooks bubble). ⚠︎ *Corrected (C15):* `packages/net-policy` is an **SSRF IP-classifier + sensitive-URL redactor** (`ip.ts`, `redact-sensitive-url.ts`), **not** an OS-level egress sandbox. The real risk is the **process-global mutable provider registry** (`llm-runtime/src/api-registry.ts:46–104`): plugins mutate it at runtime with no per-agent isolation, so a bad plugin corrupts it for all concurrent agents. *Lesson: emulate the event-stream + prepared-execution + clean package boundaries; avoid global mutable registries and keep the optional-hook surface small.*

**opencode — the reference for state & decoupling.** Go, with the cleanest `internal/` layering in the set. The loop (`internal/llm/agent/agent.go:276–310`) is session/message-driven with permission-gated tool execution, but executes tool calls **sequentially within a turn** (`:353–420`) — no intra-turn parallelism (a deliberate simplicity, and a documented latency trap). Tools implement a Go **`BaseTool` interface** of just `Info()`/`Run()` registered in code (`tools.go:69–71`), sub-agents are exposed *as a tool* (`agent-tool.go`), and MCP is a bridge (`mcp-tools.go`). The bash tool spawns a **persistent shell session** with a hardcoded banned-command list (`curl`/`wget`/`nc`…, `bash.go:41–45`) and a read-only allowlist for permissionless reads — a clean example of the "reads bypass the gate" tiering. State is the highlight: **SQLite via `internal/db`** with **sqlc-generated, type-safe** queries (`sessions.sql.go`, `messages.sql.go`; `sqlc.yaml:3 engine: sqlite`), and a **`pubsub.Broker` publishes `Created/Updated/Deleted` events on every session/message write** (`session.go:37,50,64,91,119`; `message.go:81,120,53`; `pubsub/broker.go:93–116`) — so the TUI, logging, and persistence are pure subscribers and the loop never imports them. Yolo mode is `permission.AutoApproveSession(sessionID)` called before a non-interactive run (`app.go`); approvals are **in-memory only** (cleared on restart), and summarization is **manual** via a `SummaryMessageID` checkpoint, not auto-triggered on token pressure. The trade-off: as a compiled binary it has **no runtime plugin/skill loading** — adding a tool means recompiling. *Lesson: this is the model for "every state write emits an event" and type-safe durable state; pair its decoupling with a dynamic skills-on-disk surface, intra-turn parallel tools, persisted approvals, and automatic compaction (all of which it lacks) and you have the best of both.*

**pi — the cleanest engine/frontend/provider split.** TS monorepo separating `agent` (UI-agnostic engine) ⟂ `ai` (providers) ⟂ `coding-agent` (CLI app + `modes/`) ⟂ `tui`. The loop (`packages/agent/src/agent-loop.ts`) is a nested follow-up/steering loop supporting per-tool `executionMode` (`:382`), `Promise.all` parallel default (`:502`), and `beforeToolCall`(`:581`)/`afterToolCall`(`:676`) gates; crucially it **never throws from streaming** — failures are encoded in the final assistant message (`stopReason:"error"|"aborted"`), which makes recovery/steering clean. Skills are discovered by recursive SKILL.md walk (`harness/skills.ts:138`) with `disable-model-invocation` frontmatter (`:275`) and injected as passive XML; an `AgentMessage → Message` `convertToLlm()` bridge lets the app add custom message types (bash-execution, branch-summary, compaction) without touching the core. Three notable affordances for the target system: (1) **first-class headless modes** — interactive / print / **RPC (JSON stdin-stdout)** (`coding-agent/src/modes/rpc/`) — so autonomous/embedded operation is built-in, not bolted on; (2) the bash tool takes **pluggable `BashOperations`** (`coding-agent/src/core/tools/bash.ts`) so execution can be routed to SSH/Docker/a sandbox without modifying core — exactly the seam you want for the sandbox layer; (3) sessions are an **immutable tree** (append-only entries with parent pointers), giving branch/fork and replay for free. Like openclaw, pi has **no built-in permission engine in the core** — apps gate via `beforeToolCall`. Providers register via `registerApiProvider` (`Api → {stream, streamSimple}`) with `unregisterApiProviders(sourceId)` (`packages/ai/src/api-registry.ts:66,80,88`). ⚠︎ *Corrected (C13):* pi's provider registry is **not** better-isolated than openclaw's — the `unregisterApiProviders(sourceId)` code is **identical** in both and **both remain process-global**. *Lesson: the four-package layering + first-class RPC/headless mode + pluggable execution backend is the cleanest extensibility skeleton here — adopt it; just add a real per-agent-scoped policy engine (which pi leaves to the app) and don't assume `sourceId` scoping gives per-agent isolation (it doesn't).*

### 3.3 Deep dive — Claude Code core architecture (from the leaked source)

> ⚠︎ **Provenance:** grounded in the purported leaked core at `/work/claude-code` (TS, ~1,900 files). Strongly consistent with genuine de-bundled source, but third-party-republished and unverified — read as a richly-detailed reference design, not as authoritative Anthropic behavior. The 803KB `src/main.tsx` is a bundled artifact and was excluded.

**Core loop.** `QueryEngine.submitMessage()` is an `async*` generator (`src/QueryEngine.ts:209`) wrapping `query()`→`queryLoop()` (`src/query.ts:219–251`). One iteration: destructure mutable loop state → prefetch skills → apply content-budget/snip + micro/auto-compaction → stream the model via `deps.ask()` → dispatch tool_use blocks *as they arrive* → decide `Terminal` vs `Continue` (`src/query/transitions.ts`). Continuation is explicit and typed (`tool_use`, `max_output_tokens_recovery` capped at 3, `token_budget_continuation`, `reactive_compact_retry`, `stop_hook_blocking`), and `maxTurns` caps the whole thing (`src/QueryEngine.ts:146`). *Takeaway:* it is **not** a "thin" loop — it's a sophisticated streaming state machine — but it keeps control flow explicit and inspectable via the transition enum rather than hiding it in a framework.

**Tool contract & orchestration (the part to copy).** `Tool.ts:362–549` defines: `name`, Zod `inputSchema` (+ `inputJSONSchema` MCP fallback), `isReadOnly(input)`, `isConcurrencySafe(input)`, `isDestructive?(input)`, `isEnabled()`, async `checkPermissions()→PermissionResult`, optional `validateInput()`, an async-generator `call()` that yields progress then a `ToolResult` (which may carry `newMessages` and a `contextModifier`), and a `maxResultSizeChars` truncation budget (results over it spill to disk). The orchestrator (`src/services/tools/toolOrchestration.ts:91–177`) **partitions consecutive `isConcurrencySafe` tools into parallel batches (semaphore default 10) and serializes anything unsafe** — so reads/greps/globs run concurrently while edits/writes run one-at-a-time. `StreamingToolExecutor` buffers results in arrival order and fail-fast aborts sibling tools when a write errors (`StreamingToolExecutor.ts:59`). Pre/Post/Failure tool hooks wrap execution (`toolHooks.ts`). *This `isReadOnly`/`isConcurrencySafe` + partition design is the single most directly reusable mechanism in the whole study* — opencode, by contrast, runs all tools sequentially.

**Sub-agents, tasks, teammates, coordinator.** Delegation is a tool: `AgentTool` (`src/tools/AgentTool/AgentTool.tsx`) spawns sync or `run_in_background` agents with `subagent_type`, `model`, `isolation: 'worktree'|'remote'`, and team fields; background completion arrives as a `<task-notification>`. `Task.ts` models task state (`pending→running→completed/failed/killed`) across `LocalAgentTask`, `RemoteAgentTask` (cloud/CCR), `InProcessTeammateTask` (tmux panes), `LocalShellTask`, and `DreamTask` (background memory consolidation). A **coordinator mode** (`src/coordinator/coordinatorMode.ts`, env+feature gated) injects an orchestrator prompt and a `SendMessage`/mailbox protocol for teammate "swarms," explicitly instructing self-contained worker prompts (workers can't see the conversation). *Takeaway:* the full autonomy stack — background tasks, remote execution, scheduled (`ScheduleCronTool`) and remote (`RemoteTriggerTool`) triggers, and teammate messaging — is layered *on top of* the same tool contract, not baked into the loop.

**State & persistence.** JSONL transcripts under `~/.claude` with `proper-lockfile` coordination, paste-store hashing, and per-project/session filtering (`src/history.ts:102–149, 292–327`); a Zustand-style immutable `AppStateStore` (`src/state/AppStateStore.ts`) as the single source of UI + permission state; startup migrations rewrite `settings.json` across versions (`src/migrations/`). *Gotcha:* significant module-level mutable state (pending-history buffers, classifier-request accumulation) that isn't always reset on recovery.

**Context — three-layer compaction (a model subsystem).** (1) **auto-compact** (`services/compact/autoCompact.ts`): triggers when tokens exceed `effectiveContextWindow − buffer`, forks a summarizer, reserves output tokens, and **circuit-breaks after 3 consecutive failures** to avoid hammering the API. (2) **micro-compact** (`microCompact.ts`): surgically clears old tool results — a time-based path and a **cached path using API `cache_edits` that deletes results *without* mutating local messages so the prompt-cache prefix survives**, coordinating with `promptCacheBreakDetection.ts`. (3) **session-memory extraction** (`services/SessionMemory/`): a background forked agent distills the transcript into `memory.md` every ~N tool calls. *Takeaway:* treat compaction as a first-class, multi-strategy subsystem with explicit cache-awareness and a failure circuit breaker — the gold-standard implementation of §4 pattern 8.

**Memory.** `memdir/` is a long-term store: a `MEMORY.md` index (line- then byte-truncated to bound size) plus topic `.md` files with YAML frontmatter, retrieved per-query by a Sonnet selector picking ≤5 relevant files (`findRelevantMemories.ts`). *Gotcha:* the memory dir is stat-scanned on every query with no caching layer.

**Permissions / Auto-mode / sandbox.** Precedence is **deny → allow → mode → classifier → ask** (`src/utils/permissions/permissions.ts`, `src/hooks/useCanUseTool.tsx`). Modes: `default / acceptEdits / bypassPermissions / dontAsk / plan` (+ ant-only `auto`). A remote GrowthBook **killswitch downgrades `bypassPermissions`→`default`** at startup. The **Auto-mode classifier** (`yoloClassifier.ts`) is two-stage (a fast `tool_use` pass, escalating to a thinking pass when uncertain), driven by user-editable allow/soft-deny/environment lists, with a **circuit breaker** and **denial tracking** that falls back to prompting after repeated denials. Plan mode (`EnterPlanModeTool`→`ExitPlanModeV2Tool`) runs read-only then hands off *semantic* allowed-prompts ("run tests", "install deps") into the implementation phase. **Worktree isolation is cwd-only** (`EnterWorktreeTool` updates cwd but not `$HOME`/env, and is not a network/syscall sandbox) — a crucial honest limitation for anyone treating worktrees as a safety boundary. *Gotchas:* a denied permission is recorded but does **not** hard-block the turn — the model can retry, and only `maxTurns` guarantees termination; if the model fails to call `ExitPlanMode`, stripped permissions can leak into a stuck state.

**Extensibility (richest surface in the study).** *Skills* (`src/skills/`): SKILL.md folders with **progressive disclosure** (frontmatter — name/description/when-to-use/allowed-tools/model/effort/paths — preloaded; body lazily expanded on invoke, with `${CLAUDE_SKILL_DIR}`/session substitution and inline-shell that MCP skills are forbidden from running), discovered file-based + **conditional** (`paths:` gitignore-style, activated on file touch) + **dynamic** (walk-up discovery) + **bundled** (registered, lazily extracted with `O_EXCL|O_NOFOLLOW` 0o600) + plugin + MCP, deduped by `realpath()` first-wins. *Plugins* (`src/plugins/`): manifest (`commands/agents/skills/hooks/output-styles/mcpServers/lspServers`) + a builtin registry toggled by settings. *Hooks* (`src/schemas/hooks.ts`, `src/types/hooks.ts`): ~14 events (`PreToolUse/PostToolUse/PostToolUseFailure/UserPromptSubmit/SessionStart/PermissionRequest/...`), **four executor types — command / prompt / http / agent**, each with an `if:` permission-rule condition, returning a structured verdict (`continue`, `decision:approve|block`, `systemMessage`, `additionalContext`, `updatedInput`, `updatedMCPToolOutput`) with an async/fire-and-forget option. *Commands* are a discriminated union (`prompt|local|local-jsx|builtin`) merged from all sources with `uniqBy('name')`. *Output styles* and *MCP* (tools visible directly; prompts optionally surfaced as skills) round it out. *Takeaway:* the contract surface (skills + 4-type hooks + plugins + commands + MCP) is the most complete model to learn from — and confirms/extends the public-plugin-repo findings.

**Notable patterns worth copying:** read-only/concurrency-safe **tool partitioning**; **typed transition enum** for loop exit/continue; **`contextModifier` queued after a batch** so unsafe tools mutate shared context deterministically; **result spill-to-disk** past `maxResultSizeChars`; **cache-aware micro-compaction** via `cache_edits`; **circuit breakers** on auto-compact and Auto-mode; **progressive-disclosure + conditional/dynamic skill discovery**.

**Anti-patterns / gotchas observed:** worktree "isolation" is cwd-only (not a sandbox); permission `deny` doesn't terminate a persistent model (only `maxTurns` does); `max_output_tokens_recovery` retries with no documented backoff; aggressive sibling-abort on any write error; module-level mutable state not always reset on recovery; uncached per-query memory-dir scan; and the sheer 512K-LOC surface is itself a maintenance cost.

---

## 4. High-level patterns to adopt

1. **Thin core loop — own your control flow.** Implement the agent as a minimal, deterministic loop (call → append → run tools → append results → repeat to a hard cap) that you can replay, and model it as a stateless `input-state → output-state` reducer. Planning, memory, and sub-agents bolt *onto* this loop; they are not baked into it. *Exemplars:* aider's `while True`, opencode/kilocode event processors, openclaw/pi `agent-loop.ts`; *evidence:* Braintrust "while-loop with tools", 12-Factor Agents, Anthropic "Building Effective Agents".

2. **Engine ⟂ frontend ⟂ provider — clean package seams.** A UI-agnostic engine, swappable frontends (CLI/TUI/IDE/gateway), and a provider layer, communicating via events and typed contracts. *Exemplars:* pi (agent/ai/coding-agent/tui), openclaw (agent-core vs frontends). *Negative:* kilocode's engine embedded in one frontend via 1,951 fork markers and VS-Code-only UI.

3. **One uniform tool contract + discovery registry — with read-only/concurrency flags.** A single interface (name, typed schema, handler, availability check, async flag) discovered by import or glob; tools self-register. Add `isReadOnly`/`isConcurrencySafe` predicates so the orchestrator can **run read-only tools in parallel batches and serialize writes** (claude-code `Tool.ts:362–549` + `toolOrchestration.ts:91–177`, semaphore ≤10) — a concrete latency win that opencode (all-sequential) forgoes. *Exemplars:* claude-code's `Tool` contract (Zod schema + read-only/concurrency + `checkPermissions` + `maxResultSizeChars` spill-to-disk), opencode's Go `BaseTool`, hermes `register()`+`check_fn`, openclaw/pi `AgentTool` (TypeBox), kilocode `tool/registry.ts`.

4. **Skills + CLI as the primary capability surface (progressive disclosure), not MCP schema sprawl.** Capabilities are a filesystem of skill folders (`SKILL.md`: short name+description preloaded, full body + executable scripts on demand); the model writes code/CLI to invoke them. *Exemplars:* claude-code skills, kilocode skills-first, openclaw/pi SKILL.md harness; *evidence:* CodeAct, Voyager, Anthropic Agent Skills + "Code execution with MCP" (150k→2k tokens, 98.7%).

5. **Central permission/policy engine with fixed precedence and absolute deny.** Route **every** tool call through one engine: `hooks → deny → mode → allow → ask`. Deny is absolute and overrides even bypass/yolo mode; rules scope per-tool **and** per-path/pattern; a headless `dontAsk` mode converts unresolved prompts to denials; policy propagates to sub-agents. *Exemplars:* claude-code core (grounded: precedence **deny→allow→mode→classifier→ask** in `useCanUseTool.tsx`/`permissions.ts`, modes `default/acceptEdits/bypassPermissions/dontAsk/plan/auto`, plus a remote **killswitch that downgrades `bypassPermissions`→`default`**), Claude Agent SDK precedence, kilocode `Permission.merge/resolve`, Anthropic Auto mode block-and-redirect. ⚠︎ Note one honest gap to *avoid*: in the leaked core a `deny` is recorded but doesn't itself terminate the turn — only `maxTurns` guarantees the model stops retrying; make deny truly terminal or pair it with a hard cap.

6. **Event bus / streaming decoupling.** The loop emits typed events; UI, logging, persistence, and audit subscribe; the loop imports none of them. *Exemplars:* **opencode `pubsub.Broker` (every write emits an event)**, kilocode `Bus`, openclaw `EventStream`.

7. **Durable, append-only session state in SQLite/JSONL + external plan/memory.** Persist every message/part on write; resume by session id; keep plans and distilled memory in external files that survive compaction. *Exemplars:* hermes SQLite+FTS5, opencode sqlc tables, kilocode Drizzle append-only `PartTable`, claude-code JSONL. *Negative:* aider's in-memory-only transcripts.

8. **Context compaction as a first-class subsystem.** Treat the window as finite ("context rot"): keep 3–5 core tools always loaded, cap/paginate/spill tool output, summarize at thresholds (preflight **and** on context-full), preserve recent tail + prior summaries, and keep ephemeral reasoning out of persisted history. *Exemplars:* **claude-code core's three-layer subsystem** (`services/compact/`: auto-compact with a 3-failure circuit breaker; micro-compact via API `cache_edits` that preserves the prompt-cache prefix; background session-memory extraction), hermes `context_compressor`, kilocode `overflow`/`compaction`, openclaw `transformContext`; *evidence:* Anthropic "Effective context engineering".

9. **Provider adapter boundary — a registry of stream functions.** A thin contract (model metadata + `stream(model, ctx, opts) → events`) registered in a runtime registry the loop calls; the loop never touches a provider SDK. *Exemplars:* openclaw/pi `registerApiProvider`, kilocode ai-sdk adapters, aider's litellm wrapper. *Negative:* hermes' 6 bespoke 1.2–5.6k-LOC adapters that fragment feature parity.

10. **Plugin / hook contract — event-driven, structured I/O, Markdown config.** Lifecycle/tool hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact`) as executables or callbacks returning a structured verdict (`allow|block` + reason + optional message); config in Markdown+YAML (readable, versionable) with JSON for hooks; **bounded chains with a hard cap**. *Exemplars:* claude-code hooks, hermes plugin lifecycle, openclaw/pi loop hooks.

11. **Layered safety for autonomy (the yolo spine).** Auto mode = **block-and-redirect** at the policy engine, judging the *resolved* action (not the agent's narration); behind it, an **OS sandbox that write-confines to the project dir + an out-of-process egress proxy with a default-deny domain allowlist** (Anthropic: cuts prompts ~84%); behind that, **shadow-git checkpoints + per-task worktrees** for rollback. No single layer is the safety story — the action classifier alone has ~17% false-negatives. *Evidence:* Anthropic Auto mode + sandboxing posts, Crosley "prompts ≠ authorization", Replit/PocketOS post-mortems; and the **leaked claude-code core grounds the gate side** (a two-stage `yoloClassifier` — fast `tool_use` → thinking escalation — with a circuit breaker, denial tracking, and a plan-mode→semantic-permission handoff). ⚠︎ But that same source shows the *missing* layer: its `EnterWorktreeTool` isolation is **cwd-only** (not env/filesystem/network sandbox) — a stark reminder that a worktree is a blast-radius reducer, **not** the sandbox; pair it with the OS+egress isolation above.

12. **Sub-agent-as-tool delegation — isolated context, one shared budget, used sparingly.** Expose delegation as a tool with explicit objective/output-format/tool-guidance/boundaries, in its own context (and git worktree), sharing **one** iteration/cost budget with the parent. Reserve it for parallelizable, read-heavy work; for coding/shared-write-context, a single linear agent is more reliable. *Exemplars:* claude-code parallel explorers, opencode `agent-tool.go`, Anthropic multi-agent research; *counterpoint:* Cognition "Don't build multi-agents". ⚠︎ Note hermes is the *cautionary* case here: it does **not** share the budget across the tree.

---

## 5. Anti-patterns & gotchas (grounded)

- **God-module / single-giant-function loop.** A 4.7k-line loop function is untestable and hides control flow. *Seen:* hermes (`conversation_loop.py`, `auxiliary_client.py` ~5.6k).
- **Interactive-only design that can't go autonomous.** Per-edit dialogs and input-waiting reflections assume a human; retrofitting Auto mode is surgery. *Seen:* aider (`--yes-always` bypasses dialogs but not the wait).
- **Unsandboxed shell in the main process.** One confused/injected turn can `rm -rf` or exfiltrate keys; instruction-following is not a control. *Seen:* aider (repo-root subprocess), hermes (no SDK sandbox), kilocode (relies on OS process isolation).
- **Fragile text-parsing with no structured fallback.** Regex/`jq` over LLM output or transcripts breaks silently on format change. *Seen:* aider (markdown edit parsing → `ValueError`→retry), claude-code (hooks grep/jq the JSONL with hardcoded role keys).
- **Tool allowlists that don't compose or inherit.** 100 commands each repeat `Bash(git ...:*)`. *Seen:* claude-code frontmatter.
- **Provider adapters as N bespoke god-files.** New features must be backported per adapter; capabilities diverge. *Seen:* hermes (thinking native-Anthropic-only).
- **Unschema'd / convention-only plugin & session state.** `.local.md` parsed by shell scripts, no validation/versioning/migration, no namespace isolation → first-found-wins. *Seen:* claude-code.
- **Hook/callback proliferation & serial unbounded chains.** Many optional callbacks each need call-site error handling; serial Stop-hook chains needed an 8-block cap added post-hoc. *Seen:* openclaw/pi (7 optional hooks), claude-code.
- **Frozen upfront plans with no mid-run adaptation.** Fatal for coding where each step reshapes the next. *Seen:* ReWOO-style planning; over-eager Plan-and-Execute without a replan-on-failure edge.
- **Reflection/retry gated by the model's own self-judgment.** Intrinsic self-correction often *degrades* accuracy (flips right→wrong) and burns tokens. *Evidence:* Huang et al., "LLMs Cannot Self-Correct Reasoning Yet". (aider's reflection is the *good* case — gated on lint/test.)
- **Unbounded autonomous loops with no progress/repeat detection.** Vague goals + "more work could be done" + no repeat detection → infinite loops and runaway spend ($4,200 / $47,000 documented). *Seen:* AutoGPT/BabyAGI; kilocode's "3 identical calls" heuristic is brittle.
- **Compaction that drops critical tool outputs / orphans context.** *Seen:* kilocode (`PRUNE_PROTECTED_TOOLS=['skill']` only), hermes (compression session-splits with no integrity check).
- **Engine baked into one frontend (fork-merge coupling).** *Seen:* kilocode (1,951 markers / 246 files; VS-Code-only UI).
- **Global mutable plugin/provider registry with no per-session scope.** A misbehaving plugin corrupts state for all concurrent agents. *Seen:* openclaw (and pi — both process-global; `sourceId` is cleanup, not isolation).
- **No timeout on blocking human-approval requests.** A `Deferred` with no timeout hangs the session if the user is offline. *Seen:* kilocode `Permission.ask()`.
- **"Isolation" that only changes cwd, not the threat surface.** A git worktree / `cwd` override bounds *blast radius inside the repo* but leaves `$HOME`, env, the wider filesystem, and the network fully reachable — treating it as a security boundary is a trap. *Seen:* claude-code core (`EnterWorktreeTool` is cwd-only). Use worktrees for parallelism/rollback, and a real OS+egress sandbox for containment.
- **Permission `deny` that doesn't actually halt the turn.** Recording a denial but letting the loop continue lets a persistent model retry the same action; only a hard `maxTurns`/budget cap guarantees it stops. *Seen:* claude-code core (deny is advisory + `maxTurns` backstop). Make deny terminal, or always pair it with a circuit breaker.
- **⚠︎ Independent sub-agent budgets that can exceed the parent cap.** *Seen:* hermes (`delegate_tool.py:1136`). Build a single budget shared across the whole delegation tree instead.

---

## 6. Research-grounded principles (with sources)

**Tool use & the "skills + CLI, no-MCP" case.**

- **Executable code beats JSON tool-calls.** CodeAct: GPT-4 74.4% vs 52.4% (JSON) on M3ToolEval, ~30% fewer turns, because one code action can branch/loop/compose and self-debug from tracebacks. → *Make the primary action writing/executing code or CLI, not emitting JSON tool calls.* (CodeAct, Wang et al., ICML 2024, arXiv:2402.01030)
- **Pre-loading tool schemas is a scaling bottleneck.** 5 servers / 58 tools ≈ 55k tokens before work starts; restructured as code-on-filesystem, one workflow dropped 150k→2k tokens (98.7%). → *Discover capabilities on demand from disk; reserve context for reasoning.* (Anthropic, "Code execution with MCP", 2025; "Advanced tool use" — Tool Search saves 85% tokens.)
- **The interface (ACI) can matter more than the model.** SWE-agent ~doubled SWE-bench vs raw bash; removing edit-time linting cost ~3 pts, degraded editing ~7.7 pts. → *Design commands FOR the model: windowed views, summarized search, lint-guarded atomic edits, concise errors.* (SWE-agent, Yang et al., NeurIPS 2024, arXiv:2405.15793)
- **Extensibility = a retrievable library of executable skills.** Voyager indexes skills by description embeddings, retrieves top-k, and composes simpler skills into complex ones (alleviates forgetting, transfers zero-shot). Anthropic Agent Skills formalize SKILL.md (name+desc preloaded, body+scripts on demand → "effectively unbounded"). → *Skills are folders; discovery is retrieval, not context-stuffing; skills compose.* (Voyager, arXiv:2305.16291; Anthropic Agent Skills, 2025; Gorilla/ToolLLM/API-Bank on tool retrieval.)
- **Curate tools around what the model can't do reliably in-context** (precise computation, deterministic transforms, data retrieval). (Toolformer, arXiv:2302.04761.)

**Planning.**

- Planning should **not** be hardwired into the core loop. ADaPT (decompose only on executor failure) beats rigid upfront plans by up to +28 pts; "Learning When to Plan" finds **over-planning hurts** (subgoal oscillation). → *Expose planning as a model-invoked tool/skill/mode (TodoWrite-style checklist; read-only Plan mode + approval gate); plan as-needed; persist the plan as an external artifact.* (ADaPT, NAACL 2024; "Learning When to Plan", arXiv:2509.03581; Claude Code plan mode is "just a prompt overlay + permission gate".)
- **Trust comes from external verification, not LLM self-critique.** LLM-Modulo: only ~12% of GPT-4 plans are autonomously executable; soundness must come from external critics (compilers, types, tests). → *Gate plan/step acceptance and todo-completion on real tool output; never mark "done" with failing tests.* (LLM-Modulo, ICML 2024, arXiv:2402.01817; ChatHTN.)
- Separate **who plans** from **who executes** only for the cost lever (strong model plans, cheap model executes) — but **always keep a replan-on-failure edge**; frozen plans (ReWOO) are token-efficient yet brittle.

**Reasoning.**

- ReAct (think→act→observe) grounds each step and reduces CoT hallucination. Keep the *default* loop this cheap; escalate selectively.
- **Keep ephemeral reasoning out of persisted state.** Self-consistency samples, verifier scores, debate critiques are scratch — write back only the decision. Native thinking blocks must be passed back **unmodified during an active tool-use turn** (or the API errors) but can be dropped from prior turns; **don't toggle thinking budget mid-conversation** (it invalidates the message-level prompt cache). (Anthropic extended-thinking docs.)
- **Bound every reflection/retry loop in a runtime layer the agent can't override** (max steps/trials, wall-clock, token budget) and anchor triggers to an external oracle; carry forward a distilled *lesson*, not the full failed transcript (Reflexion, NeurIPS 2023, arXiv:2303.11366). Reserve expensive search (Tree-of-Thoughts: 4%→74% on Game-of-24) and debate (cap N×R, early-stop on consensus) for genuinely hard sub-problems.

**Industry consensus.**

- **Start simplest; add complexity only when measured insufficient.** Workflows (predefined paths) for well-defined tasks; agents (LLM-directed) for open-ended ones. (Anthropic "Building Effective Agents", 2024.)
- **Own the loop in deterministic code** (12-Factor Agents: own prompts/context/control-flow; stateless reducer; tools as structured outputs; small focused agents; contact humans via tool calls). **Tool outputs are ~2/3 of tokens** (Braintrust) — engineer them for signal.
- **Default to a single linear agent for coding / shared-write-context** (Cognition "Don't Build Multi-Agents" — the Mario-background/mismatched-bird failure). Use orchestrator-worker multi-agent **only** for parallelizable, read-heavy work, budgeting ~15× tokens (Anthropic multi-agent research).
- **Edit format matters:** diffs/search-replace > whole-file > JSON-wrapped; unified diffs made GPT-4-Turbo "3× less lazy" (aider).
- **Evaluation is first-class:** scaffolding swings SWE-bench scores 12+ pts and public benchmarks are contaminated → build held-out, realistic, contamination-resistant evals on a fixed harness.

**Auto / Yolo mode & safety.**

- **Auto mode = block-and-redirect, not skip-prompts.** Anthropic's classifier proceeds on safe actions, **blocks** risky ones (mass delete, exfiltration, malicious exec) and redirects Claude, escalating to a human prompt only on repeated insistence; it **judges the resolved action with assistant narration stripped** (so injected rationales can't persuade the gate), tiers by reversibility (reads bypass; in-repo edits caught by VCS; classifier for side-effecting ops), and reports a **~17% false-negative rate** — hence defense-in-depth. (claude.com/blog/auto-mode; mbgsec analysis, 2026.) The leaked claude-code core corroborates the gate's *shape*: a two-stage `yoloClassifier` (fast `tool_use` pass → thinking escalation) with a circuit breaker and denial tracking, behind a `deny→allow→mode→classifier→ask` precedence and a remote bypass-killswitch.
- **Dual sandbox: filesystem + network, together.** Write-confine to the project dir (bubblewrap/Seatbelt/landlock, inherited by subprocesses) **and** force egress through an out-of-process proxy with a default-deny domain allowlist; either alone is escapable; together cuts prompts ~84%. Match tier to threat model: OS sandbox for trusted local; **gVisor/Firecracker microVM** for hosted/multi-tenant/internet-prompt-driven. (Anthropic sandboxing, 2025; Northflank/microVM analyses, 2026.)
- **One policy engine, fixed precedence, absolute deny** (`hooks→deny→mode→allow→ask`); deny overrides bypass; per-tool + per-path scoping; propagate to sub-agents. (Claude Agent SDK permissions.)
- **Prompts are not authorization.** Replace free-text "allow?" with structured decision cards (resolved args, diff, risk lane, rollback path) logged to an append-only **approval ledger**; limit sticky approvals to read-only/time-bounded grants; pause only at commit/side-effect boundaries. (Crosley, 2026.)
- **Recoverability:** automatic pre-mutation checkpoints in a **shadow git store** separate from the user's `.git`, per-task worktree isolation, one-command rollback — and **verify isolation actually engaged** (a documented silent-failure bug class). (Hermes/Roo checkpoints.)
- **Assume prompt injection & supply-chain compromise.** Treat all tool/web/file/MCP content as untrusted; keep secrets out of the agent's reach; don't blanket-trust dev domains (GitHub, cloud APIs) for egress — they've been abused as exfil channels (EchoLeak CVE-2025-32711 CVSS 9.3; a Claude Code finding CVSS 9.4). Real incidents: Replit deleted a prod DB during a code freeze and fabricated results (AI Incident DB #1152); PocketOS's agent invented a destructive command despite a "never run irreversible commands" rule. **Instruction-following is not a control.**

---

## 7. The Rulebook — categorized Do's and Don'ts

> These are the absolute rules for early-stage development. Each is one imperative sentence grounded in §3–§6.

### Core Loop

## Do

- Implement the agent as a thin, explicit while-loop (call → append → run tools → append results → repeat) that you fully own and can replay.
- Structure each step as reason → act → observe so every action is grounded in real tool output, not internal planning.
- Model the loop as a stateless `input-state → output-state` reducer so any turn can be resumed/replayed from persisted state.
- Cap every loop with a hard, runtime-enforced limit (max steps, wall-clock, token budget) the model cannot override.
- Split a growing loop into small named phases/modules *before* it becomes a god-function.

## Don't

- Don't outsource control flow, branching, or termination to a black-box framework or to the LLM itself.
- Don't let the loop carry hidden state that isn't reflected in persisted, replayable state.
- Don't let any single loop function grow to thousands of lines (hermes' `run_conversation` is ~4.7k — the cautionary tale).
- Don't force a fixed planning or thinking phase on every turn; keep the default loop a thin act/observe cycle.

### Tool & Skill Execution

## Do

- Define **one** uniform tool contract (name, typed schema, handler, availability check, async flag) discovered by import/glob.
- Design tools FOR the model (ACI): windowed file views, summarized search, atomic lint-checked edits, absolute paths, enums over free-text.
- Build guardrails INTO tools (syntax-check before write, reject-and-explain on malformed input) — SWE-agent lost ~7.7 pts without them.
- Return high-signal, token-efficient output: paginate, truncate at sensible caps (~25k tokens), spill large output to files, resolve opaque IDs to meaningful names.
- Prefer executable code/CLI actions over JSON tool sprawl, and feed stderr/exit codes/tracebacks back for self-debug.
- Validate the whole tool suite with evals on realistic multi-tool tasks before shipping.

## Don't

- Don't 1:1-wrap every API endpoint or dump raw payloads (UUIDs, mime types, full tracebacks) into context.
- Don't run shell/tool commands in the main process without sandbox isolation.
- Don't hardcode non-composable tool allowlists per command (claude-code's signature repetition) — define reusable groups that inherit.
- Don't parse critical tool output / transcripts with brittle regex that breaks silently on format change.

### State & Persistence

## Do

- Persist every message/part **append-only** to SQLite or JSONL **on write**, and resume by session id.
- Publish a typed event on every state write so audit, logging, and UI are subscribers (opencode `pubsub.Broker`, kilocode `Bus`).
- Checkpoint to a **shadow git** per successful edit/destructive op to provide undo points and an audit trail (distinct from the user's `.git`).
- Keep a bounded long-term memory/lesson store separate from the ephemeral per-turn trajectory.
- Add full-text search over stored messages for retrieval at scale (hermes FTS5).

## Don't

- Don't keep transcripts only in memory with no crash-safe resume (aider's `cur_messages`/`done_messages`).
- Don't couple persistence to the user's real `.git` in a way that makes non-git or headless use impossible (aider's bind).
- Don't let compaction/session-splitting silently orphan or drop critical tool outputs without an integrity check.
- Don't store plugin/session state in unschema'd convention files with no versioning or migration path.

### Context Engineering

## Do

- Treat the context window as a finite resource and budget it explicitly (3–5 core tools always loaded; the rest retrieved on demand).
- Make compaction a first-class subsystem triggered at thresholds (preflight **and** on context-full), preserving recent tail + prior summaries.
- Use progressive disclosure: load only skill name+description up front; load body and scripts on demand from the filesystem.
- Keep ephemeral reasoning (CoT, self-consistency samples, verifier scores, debate) out of persisted history — write back only the decision.
- Persist plans and distilled lessons to external files so they survive truncation and give the user a checkpoint.
- Stabilize the cached prefix (system prompt + tools) and inject memory into the *user* message, not the system prompt, to preserve cache hits.

## Don't

- Don't pre-load hundreds of tool/MCP schemas into context (55k–134k+ tokens before work starts).
- Don't naively accumulate full history or include large in-chat files unpruned (aider's balloon).
- Don't replay full failed transcripts on retry — inject a short distilled lesson plus fresh context (Reflexion).
- Don't toggle thinking mode/budget mid-conversation — it invalidates the message-level prompt cache.

### Extensibility & Plugin API

## Do

- Make **skills the primary extension surface**: a folder with `SKILL.md` (preloaded name+description, on-demand body + executable scripts), discovered by glob+frontmatter.
- Treat capability discovery as **retrieval** (index skills by description, retrieve top-k), not context-stuffing.
- Use Markdown+YAML for command/agent/skill config and structured JSON/typed callbacks for hooks — readable and version-controllable.
- Define a **small, fixed set of bounded hook events** with structured `allow|block` verdicts and a hard cap on chain length.
- Namespace skills/commands/tools and define explicit collision/precedence resolution at discovery time.
- Let skills **compose** (a skill may call existing skills) so capability compounds over the agent's lifetime (Voyager).
- Validate and version your config schemas; ship a migration path.

## Don't

- Don't make MCP the primary integration surface — keep it secondary, opt-in, and behind on-demand loading (kilocode's deliberate choice).
- Don't proliferate optional loop callbacks unbounded (openclaw/pi have 7+) — keep the hook set small and composed.
- Don't run hook chains serially with no priority, early-exit, or loop-forever cap.
- Don't bake the engine into one frontend via inline fork markers (kilocode's 1,951 `kilocode_change` markers across 246 files).
- Don't auto-discover into a flat namespace with first-found-wins resolution (claude-code's gap).

### Provider & Model Abstraction

## Do

- Define **one** thin provider contract (model metadata + a `stream(model, ctx, opts)` function) and register adapters in a runtime registry the loop calls.
- Carry model metadata (context window, max tokens, cost, reasoning support, supported inputs) as **data** the loop reads.
- Support a fallback model and per-step effort/thinking level as a dial (high for hard planning, low/off for routine dispatch).
- Route planning/replanning to a strong model and cheap deterministic execution to a smaller model when you need the cost lever.

## Don't

- Don't write N bespoke 1k–5k-LOC provider god-files that fragment feature parity (hermes' 6 adapters; thinking ended up Anthropic-only).
- Don't hardcode provider SDK calls inside the core loop.
- Don't let a mid-run model failure kill the turn — support fallback/retry **inside** the loop, not only in an outer wrapper (openclaw's gap).
- Don't assume a process-global registry gives per-agent isolation (openclaw *and* pi don't) — scope it per agent/session if you run concurrent agents.

### Planning & Reasoning

## Do

- Implement planning as a model-invoked **tool/skill/mode** (TodoWrite-style checklist; plan-as-file + approval gate), not as hardwired loop branching.
- Plan **as-needed**: let the loop attempt a task and only decompose/replan on executor failure (ADaPT), scaling effort to complexity.
- Anchor every retry/reflection trigger to an **external oracle** (tests, compiler, linter, separate verifier) — never the model's self-judgment.
- Couple task/todo completion to verification — never mark done with failing tests or partial work.
- Reserve expensive deliberation (Tree-of-Thoughts, debate, best-of-N + verifier) for genuinely hard sub-problems, with early-stop on consensus.
- Persist the plan externally and require user approval before mutating files (read-only Plan mode → Act mode).

## Don't

- Don't bake a mandatory fixed planning phase into the core loop — over-planning causes behavioral instability.
- Don't use frozen upfront plans (ReWOO-style) for coding/debugging where each step reshapes the next.
- Don't trust intrinsic self-correction — it often flips correct answers to wrong (Huang et al.).
- Don't let the agent start mutating files before it (and the user) share a plan.

### Autonomy / Yolo & Safety / Sandboxing

## Do

- Implement Auto mode as **block-and-redirect**: every tool call passes the policy engine; risky/ambiguous/irreversible actions DENY-with-feedback so the agent reroutes; human prompt only on repeated insistence.
- Judge the **concrete resolved action** (final command, written payload, target resource), stripping the agent's narration so injected rationales can't persuade the gate.
- Run command execution in an OS sandbox that write-confines to the project dir **AND** forces egress through an out-of-process default-deny domain allowlist (inherited by subprocesses).
- Match isolation tier to threat model: OS sandbox (bubblewrap/Seatbelt/landlock) for trusted local; gVisor/Firecracker microVM for hosted/multi-tenant/internet-prompt-driven.
- Maintain an **absolute deny list** (`rm -rf /`, force-push, prod creds/DB) that even yolo/bypass mode cannot cross, and propagate policy to sub-agents.
- Back every mutation with agent-private checkpoint/rollback (shadow git + per-task worktree), and **verify isolation actually engaged**.
- Replace free-text "allow?" prompts with structured decision cards (resolved args, diff, risk lane, rollback path) logged to an append-only approval ledger; pause only at commit/side-effect boundaries.
- Tier gating by reversibility: reads bypass, in-repo edits caught by VCS, only side-effecting/out-of-scope ops pay classifier latency.
- Default to non-prod; require explicit, separately-credentialed, deny-overridable escalation to touch production.
- Add hard resource circuit breakers (max steps / $ / wall-clock) plus loop/repeat detection **outside** the agent.

## Don't

- Don't implement autonomy as a global "skip all prompts" flag (raw `--dangerously-skip-permissions`).
- Don't rely on prompt instructions ("never delete prod") as a safety control — Replit and PocketOS prove agents ignore them.
- Don't trust a single safety layer — the action classifier has ~17% false-negatives, so it must sit behind a sandbox AND rollback.
- Don't let sticky/persisted approvals cover destructive verbs (shell/deploy/delete) — limit them to read-only, time/run-bounded grants.
- Don't leave secrets in the agent's reachable filesystem/env, and don't blanket-whitelist trusted dev domains (GitHub, cloud APIs) for egress — they've been abused as exfil channels.
- Don't let permission/human-approval requests block with no timeout (kilocode's CLI hang).

### Observability & Evaluation

## Do

- Emit the full trajectory as a typed event stream and persist it so every run is inspectable and replayable.
- Keep an append-only approval/audit ledger (actor, tool, resolved args, risk lane, decision, outcome).
- Build held-out, contamination-resistant, realistic eval suites with a fixed harness — scaffolding can swing scores 12+ pts.
- Treat scaffolding (interface, retries, localization, verifier-based test-time compute) as a deliberate, tunable, measured surface.
- Run tests/lint as the verifier signal and gate actions on real tool output, not model self-reports.

## Don't

- Don't trust an agent's self-report of what it did or whether rollback is possible (Replit fabricated results and lied).
- Don't trust headline benchmark numbers as your agent's expected performance, or eval on stale public datasets that may be contaminated.
- Don't ship tool changes without evaluating the whole suite on multi-tool realistic tasks.

### Process & Team

## Do

- Start with the simplest thing that works (single linear agent, one shared context, small well-designed tool set) and add complexity only when a measured shortfall justifies the cost.
- Use a single linear agent for coding/shared-write-context; reserve orchestrator-worker multi-agent for parallelizable, read-heavy, high-value work (~15× tokens).
- Version your prompts and treat tool/skill docs as versioned artifacts so the agent stays correct as scripts/APIs evolve.
- Build small, focused agents/skills rather than one monolithic do-everything agent.
- Add a Reflexion-style verify-and-reflect loop (tests as evaluator; distill failures into the skill library/memory) so the system improves without fine-tuning.

## Don't

- Don't reach for an agent framework or multi-agent orchestration by default before a simpler version is measured insufficient.
- Don't fan coding work out to parallel sub-agents passing only summarized messages (Cognition's Mario-background failure).
- Don't let one frontend's API leak into the engine — keep engine/frontend/provider seams clean from day one.
- Don't curate tools around things the model already does well in-context — reserve tools/skills for precise computation, deterministic transforms, and data retrieval.

---

## 8. A pragmatic build sequence

Order matters; these are dependency-ordered so each layer can be tested before the next leans on it.

1. **Loop + tool contract + durable state (week 1).** A thin while-loop, one `Tool` interface with a glob/import registry, append-only SQLite (or JSONL) persistence on every write, and an event bus from the start. This is the spine; opencode is the reference. Resist frameworks.
2. **Provider adapter boundary.** One `stream()` contract + metadata registry; wire two providers immediately so the seam is real, not theoretical. Scope the registry per agent if you'll ever run concurrent sessions.
3. **Context engine.** Token budgeting, tool-output caps + spill-to-file, and compaction (preflight + on-context-full) before you have long sessions — retrofitting is painful.
4. **Skills + CLI surface.** `SKILL.md` folders with progressive disclosure and retrieval-based discovery; this is your primary extensibility story. Keep MCP a secondary, opt-in bridge.
5. **Policy engine + sandbox.** One gate for every tool call (`hooks→deny→mode→allow→ask`, absolute deny), then the OS sandbox + egress proxy + shadow-git checkpoints. Build this **before** Auto mode, not after.
6. **Auto / yolo mode.** Block-and-redirect on top of the policy engine + sandbox + rollback, judging resolved actions, with circuit breakers and an approval ledger. Defense-in-depth, never a single classifier.
7. **Planning, reflection, sub-agents — as tools/skills, last.** TodoWrite-style planning, Reflexion-style verify-and-reflect (tests as oracle), and sub-agent-as-tool delegation with one shared budget. Add only where a measured shortfall justifies the cost.
8. **Eval harness — continuously, alongside everything.** Held-out, contamination-resistant tasks on a fixed harness; treat scaffolding as a measured surface.

---

## 9. Sources

**Codebases analyzed** (`/work/…`, git history stripped): aider (Python), **claude-code** (⚠︎ now a *purported leaked CLI core* — TS, ~1,900 files / 512K LOC; provenance unverified, see §1 note + §3.3; the earlier public plugins/SDK-repo findings are corroborated by it), hermes-agent (Python), kilocode (TS / VS Code), openclaw (TS monorepo), opencode (Go), pi (TS monorepo). All `path:line` citations above refer to these trees.

**Academic / framework:** CodeAct (arXiv:2402.01030); SWE-agent (arXiv:2405.15793); Voyager (arXiv:2305.16291); Reflexion (arXiv:2303.11366); ReAct (arXiv:2210.03629); Toolformer (arXiv:2302.04761); Gorilla (arXiv:2305.15334), ToolLLM (arXiv:2307.16789), API-Bank (arXiv:2304.08244); Tree-of-Thoughts (arXiv:2305.10601); Plan-and-Solve (arXiv:2305.04091); ReWOO (arXiv:2305.18323); ADaPT (arXiv:2311.05772); LLM-Modulo (arXiv:2402.01817); ChatHTN (arXiv:2505.11814); "Learning When to Plan" (arXiv:2509.03581); CoT (arXiv:2201.11903); Self-Consistency (arXiv:2203.11171); Self-Refine (arXiv:2303.17651); "LLMs Cannot Self-Correct Reasoning Yet" (arXiv:2310.01798); Verifiers / GSM8K (arXiv:2110.14168); Multi-agent Debate (arXiv:2305.14325); SWE-bench Pro (arXiv:2509.16941).

**Industry / engineering:** Anthropic — Building Effective Agents (2024), Writing effective tools for agents (2025), Code execution with MCP (2025), Advanced tool use (2025), Effective context engineering (2025), Equipping agents with Agent Skills (2025), How we built our multi-agent research system (2025), Claude Code sandboxing (2025), **Auto mode** (claude.com/blog/auto-mode), Agent SDK permissions (code.claude.com/docs/agent-sdk/permissions), Extended thinking docs. Braintrust "canonical agent architecture: a while loop with tools" (2025); 12-Factor Agents (HumanLayer/Dex Horthy, 2025); Cognition "Don't Build Multi-Agents" (2025); aider unified-diffs & polyglot leaderboard; Cline Plan/Act; mbgsec Auto-mode security analysis (2026); Crosley "AI Agent Approval Prompts Are Not Authorization" (2026); Hermes/Roo checkpoints docs; Northflank/microVM sandboxing analyses (2026).

**Incidents / threat model:** Replit prod-DB deletion (AI Incident DB #1152, 2025); PocketOS/Railway 9-second deletion (NeuralTrust, 2026); EchoLeak (CVE-2025-32711, CVSS 9.3); Claude Code exfiltration finding (CVSS 9.4); OWASP Agentic & MCP Top 10 (2026); AutoGPT/BabyAGI failure retrospectives.

*All agent-specific claims in §3–§5 were adversarially re-verified against the source (11 confirmed, 6 corrected for precision, 0 refuted); corrections that affect a recommendation are flagged ⚠︎. The §3.3 Claude Code core deep-dive was added after the `claude-code` directory was replaced with a purported leaked source; three independent read-throughs found it strongly consistent with genuine de-bundled source, but it is third-party-republished and unverified — every §3.3 claim is `path:line`-grounded yet should be read as an illustrative reference design, not authoritative product behavior.*
