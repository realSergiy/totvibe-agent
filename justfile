set shell := ["bash", "-euo", "pipefail", "-c"]

alias i := install
alias k := knip
alias tc := typecheck
alias l := lint
alias t := test
alias c := check
alias tv := up
alias w := serve
alias bs := build-sandbox
alias cl := clone
alias u := upgrade
alias ui := upgrade-interactive

# List available recipes.
default:
    @just --list

# Install JS dependencies.
install:
    bun install

# Run the totvibe terminal coding assistant (sandboxed to the working dir by default; pass --no-sandbox to disable)
up *args:
    bun start {{ args }}

# Serve the totvibe web UI (Bun.serve + WebSocket agent backend in one process)
serve *args:
    bun run serve {{ args }}

# Find unused files, dependencies, and exports across the workspace
knip:
    bun run knip

# Typecheck every workspace package
typecheck:
    bun run typecheck

# Lint and format every workspace package: eslint --fix + prettier --write
lint:
    uv run --group lint rumdl check --fix
    bun run lint:fix
    bun run format

# Run both test suites: terminal (OpenTUI) and web (happy-dom)
test:
    bun run test

# Full gate: install, knip, typecheck, lint, test — autofix throughout.
check: install knip typecheck lint test

# Build the Linux Landlock + namespace sandbox helper (needs Rust)
build-sandbox:
    bun run build:sandbox

# Shallow-clone a repo (owner/name or URL) into reference_clones/; optional ref keeps history back to but excluding that commit/tag (e.g. just clone microsoft/vscode 1.121.0)
clone repo ref="":
    scripts/clone_reference.py {{ repo }} {{ ref }}

# Upgrade JS dependencies across the workspace via ncu (catalog-aware). Forwards extra args (e.g. `just u -i`).
upgrade *args='':
    bun run upgrade -- {{ args }}

# Interactively select and apply upgrades, then reinstall.
upgrade-interactive:
    bun run upgrade -- -i
    bun install
