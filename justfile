default:
    @just --list

# Run the totvibe terminal coding assistant (sandboxed to the working dir by default; pass --no-sandbox to disable)
totvibe *args:
    bun start {{args}}

# Build the Linux Landlock + namespace sandbox helper (needs Rust)
build-sandbox:
    bun run build:sandbox
