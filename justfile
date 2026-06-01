default: totvibe

# Run the totvibe terminal coding assistant (sandboxed to the working dir by default; pass --no-sandbox to disable)
alias tv := totvibe
totvibe *args:
    bun start {{ args }}

# Run the test suite (scoped to packages/ so reference_clones/ is never scanned)
alias t := test
test:
    bun test ./packages

# Typecheck every workspace package
alias tc := typecheck
typecheck:
    bun run typecheck

# Lint every workspace package with typescript-eslint (strict, type-checked)
alias l := lint
lint:
    bun run lint

# Find unused files, dependencies, and exports across the workspace
alias k := knip
knip:
    bun run knip

# Gate: lint, typecheck, knip, then test
alias c := check
check: knip typecheck lint test

# Build the Linux Landlock + namespace sandbox helper (needs Rust)
alias bs := build-sandbox
build-sandbox:
    bun run build:sandbox

# Shallow-clone a repo (owner/name or URL) into reference_clones/; optional ref keeps history back to but excluding that commit/tag (e.g. just clone microsoft/vscode 1.121.0)
alias cl := clone
clone repo ref="":
    scripts/clone_reference.py {{ repo }} {{ ref }}
