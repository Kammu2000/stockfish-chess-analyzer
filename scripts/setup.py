#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
One-time dev environment setup: clones/activates emsdk at the pinned version
and checks out the Stockfish submodule.
Run from the repo root: uv run scripts/setup.py
"""

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EMSDK_DIR = REPO_ROOT / "emsdk"
EMSDK_REPO_URL = "https://github.com/emscripten-core/emsdk.git"
VERSION_FILE = REPO_ROOT / ".emscripten-version"


def run(cmd, cwd=None):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=cwd)


def main():
    version = VERSION_FILE.read_text().strip()
    print(f"Pinned Emscripten version: {version}")

    print("\n── Step 1: emsdk ──────────────────────────────────────────────")
    if not EMSDK_DIR.exists():
        run(["git", "clone", EMSDK_REPO_URL, str(EMSDK_DIR)])
    else:
        print(f"  {EMSDK_DIR} already present, skipping clone.")

    emsdk_bin = EMSDK_DIR / "emsdk"
    run([str(emsdk_bin), "install", version], cwd=EMSDK_DIR)
    run([str(emsdk_bin), "activate", version], cwd=EMSDK_DIR)

    print("\n── Step 2: Stockfish submodule ─────────────────────────────────")
    run(["git", "submodule", "update", "--init", "engine/stockfish"], cwd=REPO_ROOT)

    print(
        f"✓ Setup complete. Emscripten {version} activated in {EMSDK_DIR}. "
        "Run `npm run build-cpp` to build Stockfish to WASM."
    )


if __name__ == "__main__":
    main()
