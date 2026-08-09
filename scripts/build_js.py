#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Type-checks and builds the JS/TS bundle via webpack.
Run from the repo root: uv run scripts/build_js.py --mode production|development
"""

import argparse
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def run(cmd):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=REPO_ROOT)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["production", "development"], default="production")
    args = parser.parse_args()

    print("── Step 1: Type-checking (tsc --noEmit) ──────────────────────")
    run(["npx", "tsc", "--noEmit"])

    print(f"\n── Step 2: Building webpack bundle ({args.mode}) ─────────────")
    run(["npx", "webpack", "--mode", args.mode])

    print(f"\n✓ JS build complete ({args.mode}).")


if __name__ == "__main__":
    main()
