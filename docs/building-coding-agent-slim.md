# Building a Coding Agent on OpenTUI + Bun: A Comprehensive Plan

## 0. Guiding principles (the "why" before the "what")

A coding agent in 2026 is fundamentally **a streaming tool-use loop wrapped in a TUI, with a classifier on the side and a retrieval layer underneath.** Everything else is decoration. The job of your architecture is to keep those four concerns cleanly separable so each can evolve independently.

Four invariants drive every decision below:

1. **The agent loop is a pure async generator.** No UI imports, no DB imports, no SDK assumptions beyond "messages in, message events out." This is what lets you swap Claude Opus 4.7 for a local model, or wrap the loop in ToT/AoT later.
2. **Tools are values, not classes hardcoded into the loop.** A tool is `{ name, description, schema, handler, riskHints }`. Skills, retrieval probes, and thinking strategies are all just tools or tool collections.
3. **The TUI subscribes; it never drives.** Reactivity flows agent → event bus → React store → OpenTUI. The terminal is a view, swappable for `--print` mode or a web frontend.
4. **Safety is an interceptor, not a feature.** Auto Mode is a middleware in the tool-call pipeline. You can disable it for tests, replace its classifier, or stack additional guards without touching the loop.

If you only remember one thing: **build it like a Unix pipeline of pure async functions over an event stream, and put the TUI at the end of the pipe.**

---

## 1. Stack choice and rationale

| Layer | Choice | Why |
|---|---|---|
| Runtime | Bun 1.3+ | Native TS, fast startup, built-in SQLite, `Bun.dlopen` (OpenTUI needs it), `Bun.spawn` for shell tools, `Bun.file` for I/O. Bun loads `.env` automatically, so don't add `dotenv`. |
| TUI | `@opentui/core` + `@opentui/react` | Zig-backed renderer, used by OpenCode in production, ships React reconciler with `<box>`, `<text>`, `<input>`, `<scrollbox>`, `<code>` (tree-sitter), `<diff>`. Set `"jsxImportSource": "@opentui/react"` in tsconfig. |
| LLM SDK | `@anthropic-ai/sdk` ≥ 0.40 | `messages.stream()` returns a `MessageStream` with `.on('text')`, async iteration, and `.abort()`. Use `stream.finalMessage()` to recover the full assistant turn with `thinking` blocks intact. |
| Model | `claude-opus-4-7` for planning, `claude-haiku-4-5` for the Auto Mode classifier | Mirrors the production Auto Mode design (cheap fast classifier, capable main model). |
| Reasoning | Adaptive thinking on Opus 4.7 | Interleaved thinking is automatic on Opus 4.7 — no beta header. You **must** echo back the `thinking` blocks (with their `signature` field) on every tool-result turn or the chain breaks. |
| Storage | SQLite (Bun built-in) at MVP, swappable adapters for graph/vector later | One process, one file, zero ops at MVP. |
| Schemas | Zod + `zod-to-json-schema` | One source of truth for tool input validation and Anthropic's `input_schema`. |
| Diff/patch | `diff` library + your own apply, not shell `patch` | Auditable, reversible, classifier-inspectable. |

Skip: any MCP client, LangChain, frameworks that "manage" the loop for you. The loop is 200 lines; you want to own it.

---

## 2. The agent loop (the heart)

The loop is one async generator. It yields semantic events, never UI updates. Pseudocode:

```text
async function* runAgent(session, userMessage):
  session.messages.push(user(userMessage))
  while true:
    yield { type: 'turn_start' }
    stream = anthropic.messages.stream({
      model, system, messages: session.messages,
      tools: registry.specs(),
      thinking: { type: 'adaptive', effort: 'high' },
      max_tokens: ...,
    })

    for await event of stream:
      yield translate(event)  // text_delta, thinking_delta, tool_use_start, etc.

    final = await stream.finalMessage()
    session.messages.push(assistant(final.content))  // includes thinking blocks!

    toolCalls = final.content.filter(b => b.type === 'tool_use')
    if toolCalls.length === 0:
      yield { type: 'turn_end', stopReason: final.stop_reason }
      return

    // Run tools in parallel where independent, sequential where dependent.
    results = await pipeline.execute(toolCalls, session)
    session.messages.push(user(results.map(toToolResult)))

    for r of results: yield { type: 'tool_result', ...r }
```

Three things that look small but matter:

- **Thinking-block round-trip.** When you append the assistant turn, include every `thinking` block verbatim (including its opaque `signature`). Strip them and you lose the interleaved reasoning chain on the next turn. The SDK gives them back from `finalMessage()`; just push the whole `content` array.
- **Stop reason is the loop control, not the tool count.** Loop while `stop_reason === 'tool_use'`. Exit cleanly on `end_turn`, `max_tokens`, or `refusal`.
- **Cancellation is first-class.** Ctrl-C in the TUI calls `stream.abort()`, which aborts mid-token. The loop catches and yields `{ type: 'aborted' }`.

---

## 3. The tool pipeline (where Auto Mode lives)

Every tool call goes through a middleware chain before execution. This is the single most important architectural decision, because it's where Auto Mode, prompt-injection scanning, telemetry, and future capabilities all plug in without touching the loop.

```text
toolCall → [Tier1: allowlist] → [Tier2: in-project policy] → [Tier3: classifier]
        → [executor] → [output: prompt-injection probe] → toolResult
```

Mirroring Anthropic's published design:

**Tier 1 — Built-in safe allowlist.** Pure read tools (`read_file`, `glob`, `grep`, `list_directory`, `tree_sit_query`, `db_read`) skip every other tier. They cannot modify state. This is most calls and must be fast.

**Tier 2 — In-project file ops.** `write_file` and `edit_file` inside `cwd` bypass the classifier — they're reviewable via git. Outside `cwd`: escalate.

**Tier 3 — Transcript classifier.** Two-stage, exactly like Auto Mode:

- Stage 1: Haiku 4.5 with `max_tokens: 1` returning `yes`/`no`. Single token, ~50ms. Tuned to over-block.
- Stage 2: Haiku 4.5 with adaptive thinking, only runs if Stage 1 says block. Reduces FPR dramatically.
- The classifier sees **only user messages + the raw tool call payload**. Strip assistant prose and prior tool outputs. This is the published recipe and the reason for it: an injected file or an agent rationalization can't talk the classifier into approving.
- On block: inject the denial as a tool-result with a "find a safer path, don't route around the block" instruction. The agent gets to retry. After 3 consecutive denials or 20 total in a session, escalate (in your case, since you're permissionless Auto-only, this means: dump state and exit with a diagnostic — same as Claude Code's headless behavior).

**Output probe.** After each tool runs, before its result enters context, scan the output (file contents, shell stdout, web fetches) for prompt-injection signatures. If suspicious, prepend a system warning to the result rather than discarding it. Cheap to implement as a regex+heuristic first pass, upgradeable to a classifier later.

The pipeline lives in `src/agent/pipeline.ts` as composable middleware: `compose(tier1, tier2, tier3, executor, outputProbe)`. Each middleware is `(call, next) => Promise<result>`. This shape is what makes the agent extensible without rewrites.

**Policy is configurable in `.agent/policy.json`.** Trust boundaries (repo root, allowed external domains), block rules (mass-delete, force-push, credential grep, exfiltration), allow-exceptions. Ship sensible defaults; let users override.

---

## 4. Skills (instead of MCP)

Replace MCP entirely with a filesystem-based skill system, exactly the pattern Anthropic uses internally:

```text
~/.agent/skills/
  pdf/SKILL.md
  docx/SKILL.md
  pgsql/SKILL.md
  my-repo/SKILL.md      # project-local
./.agent/skills/
  team-conventions/SKILL.md
```

Each `SKILL.md` has frontmatter:

```yaml
---
name: pdf
description: Use when reading, extracting, filling, or generating PDFs.
allowed_tools: [read_file, write_file, bash]
---
# Body: instructions, code patterns, gotchas.
```

A skill loader at startup builds an index `{name, description}` and exposes one synthetic tool: `load_skill(name)`. When called, it returns the body verbatim. The agent itself decides when to load (the description is what triggers selection — same mechanism as MCP but with zero protocol overhead).

Why this beats MCP for your use case: no separate process, no JSON-RPC, no auth flow, no version skew. A skill is a file; a CLI subcommand (`agent skill new <name>`) scaffolds one. Skills can ship their own scripts in `skills/<name>/scripts/` that the agent invokes via the existing `bash` tool.

**CLI subcommands replace remote tools.** If you'd reach for an MCP server, write a CLI binary instead. The agent calls it through `bash`. Auth, rate-limiting, caching, retries are all in the CLI, where they're easy to test. A `gh`-style tool for your task tracker is more maintainable than an MCP server for it.

---

## 5. Reasoning strategies (ToT, AoT, and forward compatibility)

Critical design move: **the loop has one method, `run(session, message)`. Strategies wrap the loop, they don't replace it.**

A strategy is `(loop, session, problem) => Promise<Result>`. This lets you stack them:

```text
Strategy interface:
  - direct: just runs the loop once. Default.
  - tree_of_thoughts: forks N child sessions per branch, evaluates with a scorer
    tool, prunes by beam width. Each branch is its own loop invocation with a
    cloned session.
  - atom_of_thoughts: decomposes the prompt into a DAG of subquestions via a
    decomposer prompt, contracts to an "atomic" question, then delegates to
    direct or to ToT. Markovian: the contracted state is self-contained, so the
    inner loop runs fresh without the decomposition history.
  - reflexion: runs direct, evaluates result, appends a self-critique, retries
    up to N times.
```

Key implementation tip: **sessions are values you can `clone()`**. A session is `{ messages, scratchpad, budget }`. ToT clones it per branch, AoT clones it per atomic state. Because `thinking` blocks are in the messages array, the model genuinely re-thinks each branch from the cloned point, not from scratch.

The decomposer for AoT is itself just a tool — `decompose_into_dag(question) → {nodes, edges}` — implemented as a prompted Claude call returning JSON. The "atomicity" check is another tool. Strategies orchestrate; they don't reason themselves.

For now, ship `direct` and the strategy interface. Wire `--strategy=tot --beam=3` as CLI flags. Don't implement ToT/AoT until you have a real task that needs them; the interface is the deliverable for v1.

---

## 6. Retrieval (SQLite now, Graph RAG later)

The hard-won 2026 wisdom: **for code, hybrid lexical+symbol search beats vector RAG, and ad-hoc grep beats both for most queries**. Cursor, Claude Code, and Devin all default to grep/glob plus symbol navigation; embeddings are a fallback, not the foundation. Build accordingly.

Layered retrieval, agent picks the layer:

1. **Lexical** (always on): `ripgrep` exec'd via `bash`, `glob`, `read_file`. This handles 70%+ of code questions. The agent decides; no embedding budget burned.
2. **Symbolic**: tree-sitter queries (OpenTUI ships tree-sitter; reuse the parsers). Tool: `find_symbol(name)`, `find_references(symbol)`, `call_graph(symbol, depth)`. Stored in SQLite as a symbol table built on first run and incrementally updated on file changes (use `Bun.watch`).
3. **Semantic** (opt-in for prose/comments/docs): a `vector_search` tool backed by SQLite + `sqlite-vec`. Embed with Voyage code-3 or Anthropic embeddings when chunks are touched, not in a bulk pre-pass. Keeps the index cheap and fresh.
4. **Graph RAG** (extension point): a `graph_query` tool with an adapter interface. Phase 1 implementation: SQLite tables for `entities` and `relations`, populated by an extractor prompt that runs over modified files. Phase 2: swap the adapter to FalkorDB or Neo4j without touching the tool surface. The agent uses graph for multi-hop questions ("what depends on this module that also writes to the user table"); lexical handles the rest.
5. **Episodic memory**: every completed session is summarized and stored. Tool: `recall(query)`. This is what makes the agent feel like it knows your codebase over weeks.

The retrieval router is itself just a system-prompt instruction telling the agent which tool to prefer for which question shape. No clever router model needed at MVP.

**Storage abstraction.** Define `interface Store { kv, sql, vector?, graph? }`. The defaults bind to Bun's SQLite and `sqlite-vec`. The vector and graph fields are optional adapter interfaces. Swapping to FalkorDB is one file.

---

## 7. The TUI layer

OpenTUI's React binding is the right tool here, because the agent's state is naturally tree-shaped (sessions → turns → messages → blocks) and React handles that idiomatically.

State management: **a single Zustand store** (works fine in Bun, ~1KB) holds session state. The agent loop pushes events into the store via a thin adapter. Components subscribe with selectors. No prop drilling, no context juggling.

Layout (one screen, three regions):

```text
┌─ Conversation (scrollback) ──────────────────────┐
│ user> refactor the auth module                   │
│ ⏺ thinking… (collapsible)                        │
│ ⏺ tool: read_file src/auth.ts                   │
│ ⏺ tool: edit_file (diff preview, expandable)    │
│ assistant> Done. Three changes:                  │
├─ Status bar ─────────────────────────────────────┤
│ opus-4.7 · 12.4k ctx · auto · cwd ~/proj         │
├─ Input ──────────────────────────────────────────┤
│ > _                                              │
└──────────────────────────────────────────────────┘
```

Concrete component plan:

- `<ScrollBox>` for the conversation, items virtualized.
- `<Code>` for code blocks (tree-sitter highlighting is built in).
- `<Diff>` for `edit_file` previews (also built in).
- `<Input>` with multiline support, slash-command popup (`/clear`, `/skill`, `/strategy tot`, `/cost`).
- Streaming text uses `useState` + an effect that subscribes to text-delta events; React batches the updates.
- `useKeymap` (or a custom keyboard hook over OpenTUI's input events) for Ctrl-C abort, Ctrl-L clear, Esc cancel input, Shift+Tab strategy cycle.

**Headless mode**: same agent loop, but the "TUI" is `process.stdout.write` on text events. Triggered by `agent -p "do thing"`. Use the same store; just don't render React.

---

## 8. Putting it together — repo layout

```text
coding-agent/
├─ package.json               # bun, type: "module"
├─ tsconfig.json              # jsxImportSource: "@opentui/react"
├─ src/
│  ├─ index.ts                # CLI entry, arg parsing, mode switch
│  ├─ agent/
│  │  ├─ loop.ts              # the async generator
│  │  ├─ session.ts           # Session class with .clone()
│  │  ├─ pipeline.ts          # middleware composer
│  │  ├─ events.ts            # event type discriminated union
│  │  └─ strategies/
│  │     ├─ direct.ts
│  │     ├─ tot.ts            # stub + interface
│  │     └─ aot.ts            # stub + interface
│  ├─ safety/
│  │  ├─ classifier.ts        # Stage 1 + Stage 2
│  │  ├─ injection_probe.ts   # output scanner
│  │  ├─ policy.ts            # load/merge policy.json
│  │  └─ tiers.ts             # allowlist + in-project rules
│  ├─ tools/
│  │  ├─ registry.ts          # Tool type + register()
│  │  ├─ fs.ts                # read/write/edit/glob/grep
│  │  ├─ bash.ts              # Bun.spawn wrapper
│  │  ├─ search.ts            # ripgrep, tree-sitter symbols
│  │  ├─ retrieval.ts         # vector_search, graph_query
│  │  └─ skills.ts            # load_skill, list_skills
│  ├─ skills/
│  │  └─ loader.ts            # frontmatter parser, index
│  ├─ store/
│  │  ├─ db.ts                # Bun SQLite wrapper
│  │  ├─ vector.ts            # sqlite-vec adapter
│  │  ├─ graph.ts             # adapter interface + sqlite impl
│  │  └─ memory.ts            # episodic recall
│  ├─ tui/
│  │  ├─ App.tsx
│  │  ├─ Conversation.tsx
│  │  ├─ MessageBlock.tsx
│  │  ├─ ToolCallBlock.tsx
│  │  ├─ InputBox.tsx
│  │  ├─ StatusBar.tsx
│  │  └─ store.ts             # zustand store, bridge to agent events
│  └─ config.ts               # env, paths, model IDs
├─ .agent/
│  ├─ policy.json             # block rules, allow exceptions, trust boundary
│  └─ skills/                 # project-local skills
└─ tests/                     # bun:test
```

Total at MVP: ~2,500 lines of TypeScript. Not a framework, just a well-factored small program.

---

## 9. Phased build plan

**Phase 1 (a weekend) — the loop works.** Bun project, OpenTUI React, Anthropic SDK, three tools (`read_file`, `write_file`, `bash`), no classifier, no skills, no retrieval. Streaming text appears in a `<scrollbox>`. Tool calls execute. Thinking blocks survive turns. This is the spine.

**Phase 2 — Auto Mode.** Add the middleware pipeline, the two-stage classifier with Haiku 4.5, the output probe, `policy.json`. Now the agent runs unattended on small tasks. This is the smallest viable "permissionless" version.

**Phase 3 — Skills and CLI tools.** Skill loader, `load_skill` tool, scaffolding command. Move heavy capabilities (PDF, DB queries) into skills. Add a few CLI tools (`gh`-like) to demonstrate the no-MCP pattern.

**Phase 4 — Retrieval layers.** ripgrep+tree-sitter tools, then SQLite symbol index, then `sqlite-vec` for docs/comments, then the graph adapter interface (SQLite impl). Each is independently shippable.

**Phase 5 — Reasoning strategies.** Define the `Strategy` interface and `session.clone()`. Implement `direct` properly (already there). Add `--strategy` flag. Stub `tot` and `aot` with TODOs; implement when you have a benchmark task.

**Phase 6 — Polish.** Episodic memory, slash commands, cost tracking, session persistence (resume by id), headless `-p` mode for CI.

---

## 10. Pitfalls worth knowing now

- **JSX import source matters.** Without `"jsxImportSource": "@opentui/react"`, `<text>` and `<box>` won't type-check and you'll fight phantom errors for an hour.
- **OpenTUI is Bun-first.** Node and Deno support is in progress but not the path to take. Don't try to ship to Node.
- **Don't import `dotenv`.** Bun loads `.env` automatically; adding dotenv breaks ordering subtly.
- **Echo thinking blocks back.** Easiest mistake: stripping them when serializing the assistant turn. The `signature` field is the proof of provenance — pass it through untouched.
- **Permissionless is not unsafe.** "Auto Mode only" still means the classifier runs on every Tier-3 call. Removing the human approver doesn't remove the classifier, the injection probe, or the deny-and-continue retry budget. Make this explicit in your README so users don't think `--dangerously-skip-permissions` and Auto are the same thing — they aren't.
- **Embeddings are a footgun for code.** Resist the urge to embed the whole repo at startup. Ship lexical and symbolic first; let usage data tell you where semantic earns its cost.
- **Stop reason controls the loop.** Not `tool_use_blocks.length > 0`. The model can produce text-then-tool, and stopping on the first tool call breaks parallel tool use.

---

That's the plan. The throughline: **a tiny pure loop, a middleware pipeline for safety, a value-typed tool registry, and a TUI that's pure view.** Every "advanced" feature you might add later — ToT, AoT, Graph RAG, episodic memory, new model backends — slots into one of those four sockets without rewrites. That's what makes it extensible, not how much it does on day one.
