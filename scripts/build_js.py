#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Type-checks and builds the JS/TS bundle via webpack.
Run from the repo root: uv run scripts/build_js.py --mode production|development
Pass --mpr to enable the memory-profiler dev panel (lazy-loaded, requires a --mpr C++ build too).
"""

import argparse
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def run(cmd, env=None):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=REPO_ROOT, env=env)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["production", "development"], default="production")
    parser.add_argument(
        "--mpr",
        action="store_true",
        help="Bundle the memory-profiler dev panel (set MEMORY_PROFILER=1 for webpack).",
    )
    args = parser.parse_args()

    print("── Step 1: Type-checking (tsc --noEmit) ──────────────────────")
    run(["npx", "tsc", "--noEmit"])

    print(f"\n── Step 2: Building webpack bundle ({args.mode}) ─────────────")
    env = {**os.environ, "MEMORY_PROFILER": "1" if args.mpr else ""}
    run(["npx", "webpack", "--mode", args.mode], env=env)

    print(f"\n✓ JS build complete ({args.mode}).")


if __name__ == "__main__":
    main()
