default:
    @just --list

# Run the totvibe terminal coding assistant (sandboxed to the working dir by default; pass --no-sandbox to disable)
totvibe *args:
    bun start {{args}}

# Run the test suite (scoped to packages/ so reference_clones/ is never scanned)
test:
    bun test ./packages

# Typecheck every workspace package
typecheck:
    bun run typecheck

# Gate: typecheck then test
check: typecheck test

# Build the Linux Landlock + namespace sandbox helper (needs Rust)
build-sandbox:
    bun run build:sandbox

# Shallow-clone a repo (owner/name or URL) into reference_clones/; optional ref keeps history back to but excluding that commit/tag (e.g. just clone microsoft/vscode 1.121.0)
clone repo ref="":
    scripts/clone_reference.py {{repo}} {{ref}}