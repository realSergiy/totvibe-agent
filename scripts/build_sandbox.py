#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.14"
# ///
"""Build the Linux Landlock + namespace sandbox helper into packages/sandbox/bin."""

import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SANDBOX_BINARY = "totvibe-sandbox"


def main() -> None:
    if shutil.which("cargo") is None:
        sys.exit("cargo not found — install Rust from https://rustup.rs to build the sandbox helper.")

    manifest = REPO_ROOT / "sandbox-helper" / "Cargo.toml"
    subprocess.run(["cargo", "build", "--release", "--manifest-path", str(manifest)], check=True)

    bin_dir = REPO_ROOT / "packages" / "sandbox" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REPO_ROOT / "sandbox-helper" / "target" / "release" / SANDBOX_BINARY, bin_dir / SANDBOX_BINARY)


if __name__ == "__main__":
    main()
