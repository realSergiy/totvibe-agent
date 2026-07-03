# Invariants

- **Layering is acyclic:** `core ← protocol ← {view, runtime} ← apps/*`; `view` and `runtime` never import each other.
- **One cross-frontend seam:** TUI and web share state only via `protocol` wire types (`ClientCommand`/`ServerEvent`) through `view`'s `applyServerEvent` — never reach across frontends directly.
- **Agent runs server-side only:** `view` and the browser never read `process.env`, hold provider keys, or call models — connection state arrives as a `connected-providers` event.
- **`protocol` and `view` stay browser-safe:** no Node/Bun APIs, no OpenTUI, no react-dom imports.
- **JSX is per-app:** terminal code uses `jsxImportSource: @opentui/react` (its own tsconfig); everything else uses `react` — never pull OpenTUI components into the React program.
- **Test suites are isolated vitest projects:** the `tui` project never uses the happy-dom environment, the `web` project always does; shared behavior lives in `shared-stories/` over the `Harness` interface and asserts on content, not terminal glyphs.
- **Bun-native runtime, vitest tests:** `Bun.serve` (never Vite/express), `Bun.file`, `bun:sqlite`, `Bun.sql`, `Bun.redis` — no Node-library equivalents; tests run on vitest (org cerberus policy), executed under bun.
- **One agent runtime per web connection:** created on WebSocket open, torn down on close.
- **`just check` is the gate:** install → knip → typecheck → lint (eslint --fix + prettier --write) → test must pass before done; never silence a quality tool to get there.
