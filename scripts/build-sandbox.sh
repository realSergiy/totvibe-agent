#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found — install Rust from https://rustup.rs to build the sandbox helper." >&2
  exit 1
fi

cargo build --release --manifest-path "$root/sandbox-helper/Cargo.toml"

mkdir -p "$root/packages/sandbox/bin"
cp "$root/sandbox-helper/target/release/totvibe-sandbox" "$root/packages/sandbox/bin/totvibe-sandbox"

echo "built packages/sandbox/bin/totvibe-sandbox"
