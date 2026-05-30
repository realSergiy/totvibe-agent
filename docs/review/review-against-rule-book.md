# Walking Skeleton — Review against §7 "The Rulebook"

This reviews the current walking-skeleton draft (branch `sy/post-skeleton`,
commit `5ce1822`) against **§7 "The Rulebook — categorized Do's and Don'ts"** of
[`docs/agent-arch-rules.md`](../agent-arch-rules.md). It walks the ten rulebook
categories in order, cites the implementation at `file:line`, and ends with a
prioritized action list mapped to the document's own §8 build sequence.

**Framing.** This is a *walking skeleton*, so many gaps are deliberate deferrals
that §8 schedules for later. The review separates **shortfalls that are due now**
from **work that is correctly not-yet-started**, and flags the few places where
the skeleton diverges from §8's dependency order or carries more risk than its
stage implies.

## Legend

| Mark | Meaning |
|---|---|
| ✅ | **Met** — implemented and aligned with the rule |
| 🟡 | **Partial** — the seam exists but the rule is only half-satisfied |
| 🔴 | **Gap** — applicable now and not met (a real shortfall) |
| ⚪ | **Deferred** — not started, but consistent with the §8 build sequence (not yet due) |

## Scorecard

| §7 Category | Verdict | One-line |
|---|---|---|
| Core Loop | 🟡 | Thin, clean, capped — but the loop itself is **owned by the AI SDK**, not by totvibe. |
| Tool & Skill Execution | 🟡 | One clean tool contract and good guardrails; **no output caps**, no skills. |
| State & Persistence | 🔴 | **In-memory only.** No SQLite/JSONL, no resume, no checkpoints, no audit. |
| Context Engineering | 🔴 / ⚪ | Essentially unaddressed; the missing **output caps** make it urgent before §8 says. |
| Extensibility & Plugin API | ⚪ | No skills/plugins/MCP yet; the seams are clean and restraint is good. |
| Provider & Model Abstraction | 🟡 | Model injected + data-driven registry; coupled to the AI SDK; no metadata/fallback. |
| Planning & Reasoning | ⚪ | Not started — and correctly minimal (no forced planning phase). |
| Autonomy / Yolo & Sandboxing | 🟡 | **Real OS sandbox is the standout strength**; auto-mode + policy engine are the gaps. |
| Observability & Evaluation | 🔴 | Good event *stream*, but nothing persisted, no ledger, **zero tests**. |
| Process & Team | ✅ | Single linear agent, clean package seams, no god-modules — textbook. |

---

## 1. Core Loop

**Verdict: 🟡 Partial.** The code is thin, readable, and capped, but it does not
*own its control flow* — the rulebook's first and most load-bearing rule.

### What's met

- ✅ **Reason → act → observe.** Tool results are fed back to the model, so each
  step is grounded in real output rather than internal planning.
- ✅ **Hard step cap.** `stopWhen: stepCountIs(deps.maxSteps ?? 24)`
  ([`packages/core/src/loop.ts:26`](../../packages/core/src/loop.ts)).
- ✅ **No god-function.** `runAgent` is ~67 lines
  ([`loop.ts`](../../packages/core/src/loop.ts)); the hermes 4.7k-line cautionary
  tale is well avoided. This is a real strength worth protecting as the loop grows.

### Gaps

- 🔴 **You do not own the loop.** `runAgent` delegates the entire agentic cycle —
  call → run tools → append results → re-call → terminate — to the Vercel AI SDK's
  `streamText` ([`loop.ts:21-28`](../../packages/core/src/loop.ts)). totvibe owns
  only the *event projection* of one `streamText` call (the `for await` over
  `stream.fullStream`, [`loop.ts:31`](../../packages/core/src/loop.ts)). Tool
  dispatch order, parallel-vs-serial execution, continuation, and termination are
  all the SDK's. This is the §5 anti-pattern *"outsource control flow… to a
  black-box framework"* and the §7 Core-Loop **Don't**. It is the **highest-leverage
  finding** because owning the loop is the precondition for nearly every later
  rule: per-step persistence, per-turn compaction, read-only-parallel tool
  orchestration, *terminal* deny, and in-loop model fallback all need a loop body
  you control. (The AI SDK's `onStepFinish`/`prepareStep` hooks can carry *some* of
  this, but they are callbacks into the SDK's loop, not ownership of it.)
- 🟡 **Replayable / stateless reducer — only in memory.** The session is a value
  ([`session.ts:3-6`](../../packages/core/src/session.ts)) and history is appended
  on completion ([`loop.ts:58`](../../packages/core/src/loop.ts)), but it lives in a
  React `useRef` ([`App.tsx:26`](../../packages/tui/src/App.tsx)) and is never
  persisted, so no turn can be replayed after the process exits. Mid-turn steps
  aren't checkpointed. `cloneSession` exists but is unused.
- 🟡 **Only one of three caps.** §7 wants *"max steps, wall-clock, token budget."*
  Only the step cap exists. Worse, `AbortSignal` is plumbed into the engine
  ([`loop.ts:10,27`](../../packages/core/src/loop.ts)) but the TUI never passes one
  ([`App.tsx:110-114`](../../packages/tui/src/App.tsx)), so an in-flight turn can't
  be cancelled — `Ctrl+C` kills the whole process
  ([`App.tsx:141-144`](../../packages/tui/src/App.tsx)). Wiring the signal is a
  small, high-value fix.

---

## 2. Tool & Skill Execution

**Verdict: 🟡 Partial.** One clean tool contract with good reject-and-explain
guardrails; the missing piece that's *due now* is token-bounded output.

### What's met

- ✅ **One uniform tool contract.** `ToolDefinition` — name, description, Zod
  schema, `risk`, `execute` ([`tool.ts:12-18`](../../packages/core/src/tool.ts)),
  with a `defineTool` helper and a single `toModelTools` adapter. Exactly the
  *"one contract"* rule.
- ✅ **Guardrails built into tools.** `resolveInSandbox` rejects out-of-sandbox
  paths with an actionable message (*"…Ask the user to /grant it"*)
  ([`tools/index.ts:16-22`](../../packages/tools/src/index.ts)) — a clean instance
  of *"reject-and-explain on malformed input."*
- ✅ **Executable CLI action with feedback.** `run_bash` returns exit code + stdout
  - stderr ([`tools/index.ts:75-80`](../../packages/tools/src/index.ts)), enabling
  self-debug from tracebacks.
- ✅ **No brittle parsing of model output.** Tool calls are structured JSON via the
  SDK + Zod; regex appears only on *user* slash-commands and `.env` editing
  (low-risk). This sidesteps the aider/claude-code parsing anti-pattern.

### Gaps

- 🔴 **No token-efficient output — no caps, pagination, or spill.** `read_file`
  returns the entire file ([`tools/index.ts:31-35`](../../packages/tools/src/index.ts))
  and `run_bash` returns full combined output
  ([`tools/index.ts:77-79`](../../packages/tools/src/index.ts)). §7 is explicit:
  *"paginate, truncate at sensible caps (~25k tokens), spill large output to
  files."* One large file or noisy build can blow the window. This is the single
  most actionable Tool gap and it should land **before** long sessions exist.
- 🟡 **Discovery is hand-assembly, not glob/import.** Tools are listed in
  `createBuiltinTools` ([`tools/index.ts:12,83`](../../packages/tools/src/index.ts)).
  Fine at four tools; not yet the *"discovered by import/glob"* registry.
- 🟡 **ACI is basic.** No windowed file views, no summarized search, no
  lint-checked atomic edits; `write_file` is whole-file overwrite. Acceptable for a
  skeleton, but *"design tools FOR the model"* is not yet realized.
- 🟡 **In-process file tools.** `run_bash` is sandboxed (good — see §8), but
  `read_file`/`write_file`/`list_dir` execute in the main Bun process guarded only
  by an in-process path-prefix check (`allowsWrite`,
  [`sandbox/index.ts:43-46`](../../packages/sandbox/src/index.ts)). A symlink under
  `cwd` pointing outside could defeat that check (TOCTOU/symlink traversal) —
  Landlock catches this for bash but not for the JS file tools. Worth hardening.
- 🔴 **No evals on the tool suite** (see §9).

---

## 3. State & Persistence

**Verdict: 🔴 Gap.** This is the weakest category *relative to its priority* — §8
puts durable state in **step 1**, alongside the loop, yet it is absent.

### Gaps

- 🔴 **No durable, append-only state.** The session is in-memory only
  ([`session.ts:3-6`](../../packages/core/src/session.ts);
  [`App.tsx:26`](../../packages/tui/src/App.tsx)). No SQLite/JSONL, no write-on-each
  message, no resume-by-id (`Session.id` exists but is never used to load/save).
  This is the explicit aider anti-pattern: *"transcripts only in memory with no
  crash-safe resume."*(XXXXXXXXX lists*"resume session feature"* — same gap.)
- 🟡 **Event-on-write — right shape, missing subscribers.** A typed event *stream*
  exists ([`events.ts`](../../packages/core/src/events.ts);
  [`loop.ts`](../../packages/core/src/loop.ts) `yield`), which is the correct seam.
  But there is a single consumer — the TUI reducer
  ([`App.tsx:115`](../../packages/tui/src/App.tsx)) — not a bus with persistence /
  audit / logging subscribers, and **no event is persisted**. opencode's
  *"every write emits an event"* with pure subscribers is the target; the stream is
  there, the subscribers are not.
- 🔴 **No shadow-git checkpoints** per mutation (no undo/audit trail).
- 🔴 **No long-term memory/lesson store** separate from the turn trajectory.
- ⚪ **No FTS** — follows from having no store; reasonable to defer.

---

## 4. Context Engineering

**Verdict: 🔴 due-now slice / ⚪ deferred subsystem.** The compaction subsystem is
correctly a later step (§8 step 3), but the *output-cap* slice is needed sooner.

### Gaps

- 🔴 **No tool-output caps** (cross-listed from §2) — the part that bites first.
- ⚪ **No compaction** (preflight or on-context-full), **no token budgeting**, **no
  progressive disclosure**, **no external plan/lesson files**, **no cache-prefix
  stabilization.** History accumulates unbounded
  ([`loop.ts:58`](../../packages/core/src/loop.ts), in memory). These are a genuine
  subsystem and fine to defer — but note there is *zero* context-window awareness
  anywhere, so the agent will fail on long sessions before compaction is even
  reached.

### What's incidentally aligned

- ✅ **Ephemeral reasoning is kept out of the UI transcript** — the reducer drops
  `reasoning` and `tool_result` deltas
  ([`state.ts:74`](../../packages/tui/src/state.ts)). (Caveat: `response.messages`
  at [`loop.ts:58`](../../packages/core/src/loop.ts) may still carry provider
  reasoning back into history; this isn't deliberately managed yet.)

---

## 5. Extensibility & Plugin API

**Verdict: ⚪ Deferred.** Not started (§8 step 4), and the deferral is clean.

- ⚪ **No skills / `SKILL.md`, no plugin manifest, no lifecycle hooks, no MCP.**
  Tools are compiled in ([`tools/index.ts`](../../packages/tools/src/index.ts)).
  The rulebook's *primary* capability surface (skills) is therefore the project's
  biggest unbuilt bet — expected at this stage, but worth naming as the headline
  "not yet."
- ✅ **Clean seams + good restraint.** Extension points are documented (add a tool
  via `createBuiltinTools`; compose middleware), and middleware `compose`
  ([`pipeline.ts:16-22`](../../packages/core/src/pipeline.ts)) is a *single*
  composition point — notably **not** the openclaw/pi *"7+ optional loop hooks"*
  anti-pattern. When skills land, keep MCP secondary and discovery namespaced with
  explicit precedence (the two §7 **Don'ts** to honor).

---

## 6. Provider & Model Abstraction

**Verdict: 🟡 Partial.** The model is injected and the registry is data-driven, but
the abstraction *is* the AI SDK, and model metadata/fallback are absent.

### What's met

- ✅ **Model injected, not hardcoded.** The loop reads `deps.model`
  ([`loop.ts:6`](../../packages/core/src/loop.ts)); the TUI builds it via
  `buildModel` ([`config.ts:149-156`](../../packages/tui/src/config.ts)).
- ✅ **Data-driven provider registry.** `PROVIDERS`
  ([`config.ts:14-96`](../../packages/tui/src/config.ts)) — nine OpenAI-compatible
  providers as data (baseURL, key env, default model). Adding one is a one-entry
  change. No mutable global registry, so the openclaw/pi isolation footgun is
  avoided by construction.

### Gaps

- 🟡 **Coupled to the AI SDK as a framework.** `runAgent` imports `streamText` from
  `ai` ([`loop.ts:1`](../../packages/core/src/loop.ts)), so *"the provider SDK is
  never called from the loop"* is only half-true: the *vendor* SDK isn't, but the
  *framework* is — and that one call couples both provider access **and** loop
  control (see §1). Model churn within AI-SDK providers is isolated; framework
  churn / loop ownership is not.
- 🔴 **No model metadata as data.** `PROVIDERS` lacks context window, max tokens,
  cost, and reasoning support ([`config.ts`](../../packages/tui/src/config.ts)).
  §7 wants these *"as data the loop reads"* — and the missing context window is
  exactly why §4 can't budget.
- 🔴 **No fallback model / in-loop retry.** On error the turn simply ends
  ([`loop.ts:60-62`](../../packages/core/src/loop.ts)). §7: *"don't let a mid-run
  model failure kill the turn — support fallback/retry inside the loop."*
- 🟡 **Registry lives in the frontend.** `PROVIDERS`/`buildModel` are in the `tui`
  package ([`config.ts`](../../packages/tui/src/config.ts)), so a future headless
  frontend would duplicate provider logic. pi's separate `ai` package is the model;
  consider a shared `@totvibe/providers` package when the second frontend appears.
- ⚪ Effort/thinking dial and strong-plan/cheap-execute split — fine to defer.

---

## 7. Planning & Reasoning

**Verdict: ⚪ Deferred — and correctly minimal.** Not started (§8 step 7), and the
omission *satisfies* the §7 **Don'ts**.

- ⚪ No planning tool/mode, no TodoWrite, no plan→act gate, no Reflexion/verify
  loop, no external-oracle-gated retry.
- ✅ By omission it avoids every Planning **Don't**: no mandatory planning phase
  forced on each turn (the default loop is a thin act/observe cycle — exactly what
  §7 asks), no frozen upfront plans, no intrinsic self-correction. When planning
  arrives, implement it as a *tool/mode*, not loop branching, and gate
  todo-completion on real tool output.

---

## 8. Autonomy / Yolo & Safety / Sandboxing

**Verdict: 🟡 Partial — split decision.** The **OS sandbox is the project's clear
strength and is ahead of the build sequence**; the *policy* half of the same step
(precedence engine, absolute deny, ledger, rollback) and the **Auto-mode design**
are the gaps. Because autonomy/yolo is a stated project goal (`next.md`: *"gate
destructive commands (Auto mode)"*,*"auto-worktree if attempt to edit on main"*),
these gaps are high-priority.

### Strengths (genuinely good for a skeleton)

- ✅ **Real OS sandbox.** A Rust Landlock (ABI V5) + user/network-namespace helper
  ([`sandbox-helper/src/main.rs`](../../sandbox-helper/src/main.rs)): write-confines
  to `cwd` + `/tmp` + `/dev`, read of system dirs, network isolated by default via
  `CLONE_NEWNET` ([`main.rs:29-33,64-73`](../../sandbox-helper/src/main.rs)),
  filesystem via `restrict_self` ([`main.rs:75-99`](../../sandbox-helper/src/main.rs)).
  This directly satisfies *"OS sandbox that write-confines to the project dir,
  inherited by subprocesses"* (the `execvp` at
  [`main.rs:41-45`](../../sandbox-helper/src/main.rs) means children inherit).
- ✅ **Isolation is verified, not assumed.** `probeSandbox`
  ([`sandbox/index.ts:69-82`](../../packages/sandbox/src/index.ts)) detects Landlock
  support; the status bar surfaces every degraded state and `run_bash` tags
  `(unsandboxed)` output ([`tools/index.ts:78`](../../packages/tools/src/index.ts);
  `StatusBar` `sandboxLabel`). This satisfies the §6 *"verify isolation actually
  engaged (a documented silent-failure bug class)"* rule — a real strength.
- ✅ **File tools and shell share one allow-list**
  ([`tools/index.ts:16-22`](../../packages/tools/src/index.ts) ↔
  [`sandbox/index.ts:43-46`](../../packages/sandbox/src/index.ts)) — matches *"both
  honor the same allow-list."*
- ✅ **Block-and-redirect on denial.** A human "n" returns a redirect string (not a
  hard error) that nudges the model to reroute
  ([`safety/index.ts:18-21`](../../packages/safety/src/index.ts)) — correct shape.
- ✅ **The gate judges the resolved action** (the actual tool input/command:
  [`safety/index.ts:17`](../../packages/safety/src/index.ts); the approval box shows
  `formatInput` of the resolved args), not the model's narration.

### Gaps

- 🔴 **No absolute-deny list.** Nothing is unconditionally forbidden. With
  `AUTO_APPROVE=1` the gate short-circuits *every* mutating action
  ([`safety/index.ts:14`](../../packages/safety/src/index.ts)) — including
  `run_bash "rm -rf …"`, force-push, or touching prod creds. §7: *"maintain an
  absolute deny list that even yolo/bypass mode cannot cross."* The sandbox is the
  only backstop, and `AUTO_APPROVE=1` **+** `--no-sandbox`, or `+`
  `TOTVIBE_SANDBOX_NET=inherit`, removes it (exfil/destruction become possible).
- 🔴 **Auto mode = global "skip all prompts".** `AUTO_APPROVE=1` is exactly the
  flag §7 says *not* to build (the `--dangerously-skip-permissions` shape). There is
  no autonomous classifier that denies risky/irreversible actions on its own;
  block-and-redirect fires only on a human "n". The headline *"Auto mode =
  block-and-redirect"* is therefore **not** implemented.
- 🟡 **One gate, not a precedence engine.** `approvalGate` does read→allow,
  autoApprove→allow, else ask ([`safety/index.ts:13-22`](../../packages/safety/src/index.ts)).
  No `deny → mode → allow → ask` precedence, no per-path/per-pattern rules, no mode
  taxonomy beyond a boolean. The seam is right (one middleware, every mutating call
  passes it), but it is far from the §5 policy engine.
- 🟡 **Deny isn't terminal.** A "n" returns feedback and the loop continues; the
  model may retry, bounded only by the step cap and the human re-gate. Matches the
  claude-code *"deny is advisory + maxTurns backstop"* gap — lower risk here because
  a human re-approves each retry.
- 🟡 **No timeout on the approval prompt** (resolves only on keypress:
  [`safety/index.ts:17`](../../packages/safety/src/index.ts); `App.tsx` `approve`) —
  the kilocode *"no timeout → hang"* shape. Low impact interactively.
- 🔴 **No checkpoint/rollback.** `write_file` overwrites in place
  ([`tools/index.ts:62-65`](../../packages/tools/src/index.ts)); the sandbox bounds
  blast radius but there is no per-mutation undo (no shadow git, no per-task
  worktree). `next.md`'s *"auto-worktree if attempt to edit on main"* is this gap.
- 🔴 **No approval/audit ledger** — decisions aren't logged anywhere.
- 🟡 **Network is binary `none`/`inherit`** ([`sandbox/index.ts`](../../packages/sandbox/src/index.ts)
  `NetPolicy`) — default-deny-all is a safe default (good), but there is no
  out-of-process egress proxy with a default-deny *domain* allow-list, and no
  microVM tier for the hosted/multi-tenant goal in `next.md`. Reasonable to defer.
- 🟡 **No resource circuit breakers beyond the step cap**; no out-of-agent
  loop/repeat detection (§7: *"max steps / $ / wall-clock + repeat detection"*).

---

## 9. Observability & Evaluation

**Verdict: 🔴 Gap.** Good event foundation; nothing persisted, and **no tests at
all**.

- ✅ **Typed trajectory event stream** ([`events.ts`](../../packages/core/src/events.ts))
  — the right foundation for inspectability.
- 🔴 **Not persisted / not replayable** — no run is written to disk (see §3).
- 🔴 **No approval/audit ledger** (actor, tool, resolved args, decision, outcome).
- 🔴 **Zero tests.** No `*.test.ts` is tracked anywhere; `next.md` lists *"user
  story tests"*as a TODO. §7 wants*"tests/lint as the verifier signal"* and
  *"held-out eval suites."* Even granting skeleton status, *some* test of the tool
  contract and the approval gate is cheap insurance — and the global codebase-health
  expectation is for the suite to exist and pass.
- 🟡 `typecheck` exists ([`package.json`](../../package.json) scripts) but lint is
  not yet configured (`next.md`: *"add linting"*); `.rumdl.toml` covers markdown.

---

## 10. Process & Team

**Verdict: ✅ Met.** The strongest category — textbook *"start simplest."*

- ✅ **Single linear agent, one shared context, small tool set** (four tools) — no
  premature multi-agent. Exactly §7's *"start with the simplest thing that works."*
- ✅ **Clean engine ⟂ frontend ⟂ provider seams.** The monorepo splits
  core/tools/safety/sandbox/tui; `core` imports no frontend; the loop is UI-agnostic
  (returns events). This satisfies *"keep seams clean from day one"* and avoids the
  kilocode fork-coupling anti-pattern outright.
- ✅ **Small focused modules, no god-modules** — the hermes cautionary tale is
  avoided (largest engine file ~67 lines).
- 🟡 No headless/RPC frontend yet (the engine *could* run headless, but only the TUI
  drives it); provider config lives in the frontend (see §6); the system prompt is a
  single unversioned const ([`config.ts:98`](../../packages/tui/src/config.ts)) —
  all trivial today.

---

## Prioritized recommendations

Ordered by leverage, annotated with the §8 build-sequence step each belongs to.
The first three are *due now* (out of sequence or higher-risk than the stage
implies); the rest track the sequence.

1. **Own the loop (§8 step 1).** Replace the single `streamText`-runs-everything
   call with a thin explicit `while` loop you control: call model → append → run
   tools → append results → check caps → repeat. Keep `streamText` for *one model
   turn* (streaming + tool-call parsing), but own continuation/termination/tool
   dispatch. Unblocks per-step persistence, compaction hooks, read-only-parallel
   orchestration, terminal deny, and in-loop fallback.
   ([`loop.ts:21-28`](../../packages/core/src/loop.ts))
2. **Cap tool output (§8 step 2/3).** Truncate `read_file`/`run_bash` at a sensible
   limit (~25k tokens) with a "spilled to <path>" pointer. Cheapest fix that
   prevents window blow-ups. ([`tools/index.ts:31-35,77-79`](../../packages/tools/src/index.ts))
3. **Add an absolute-deny list + wire the abort signal (§8 step 5).** A small
   unconditional blocklist (`rm -rf /`, force-push, known-secret paths) that even
   `AUTO_APPROVE` cannot cross, evaluated *before* the autoApprove short-circuit
   ([`safety/index.ts:14`](../../packages/safety/src/index.ts)); and pass an
   `AbortSignal` from the TUI so a turn can be cancelled without killing the process
   ([`App.tsx:110-114`](../../packages/tui/src/App.tsx)).
4. **Persist the session append-only (§8 step 1).** JSONL or `bun:sqlite`, written
   on each message, keyed by `Session.id`, with resume-by-id. Make persistence and
   an **audit ledger** subscribers of the existing event stream.
   ([`session.ts`](../../packages/core/src/session.ts),
   [`events.ts`](../../packages/core/src/events.ts))
5. **Carry model metadata as data (§8 step 2).** Add context window / max tokens /
   cost to `PROVIDERS`, and a fallback model with in-loop retry.
   ([`config.ts:14-96`](../../packages/tui/src/config.ts),
   [`loop.ts:60-62`](../../packages/core/src/loop.ts))
6. **Promote the gate to a precedence engine + decision-card approvals (§8 step
   5).** `deny → mode → allow → ask` with per-path rules and a timeout on the human
   prompt; back mutations with shadow-git checkpoints (this is also `next.md`'s
   auto-worktree item). ([`safety/index.ts`](../../packages/safety/src/index.ts))
7. **Context compaction subsystem (§8 step 3)** and **skills surface (§8 step 4)** —
   build in sequence once the above land.
8. **Seed the test/eval harness (§8 step 8, continuous).** Start with the tool
   contract and the approval gate; grow toward the user-story tests in `next.md`.

---

## Bottom line

The skeleton is **architecturally honest where it counts**: clean package seams, a
single linear agent, a typed event stream, no god-modules (§10 ✅), and — unusually
for this stage — a **real, self-verifying OS sandbox** that is ahead of the build
sequence (§8 ✅ strengths). The defining structural risk is that **the agent loop is
the AI SDK's, not totvibe's** (§1), and the loads that depend on owning it —
**durable state** (§3), **output caps / context** (§2, §4), and the **policy/auto-mode
half of safety** (§8) — are the real shortfalls. Most other absences (skills,
planning, compaction) are correct deferrals per §8. Land recommendations 1–4 and the
skeleton graduates from "wired together" to "owns its spine."
