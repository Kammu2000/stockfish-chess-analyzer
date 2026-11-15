#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Type-checks and builds the JS/TS bundle via webpack.
Run from the repo root: uv run scripts/build_js.py --mode production|development
Pass --mpr to enable the memory-profiler dev panel (lazy-loaded, requires a --mpr C++ build too).
Pass --serve to run webpack serve instead of a one-shot build (used by start/preview).
Any other flags (e.g. --port) are forwarded to the underlying webpack command.
"""

import argparse
import os
import subprocess
import sys
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
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Run webpack serve instead of a one-shot build (used by start/preview).",
    )
    args, extra_args = parser.parse_known_args()

    print("── Step 1: Type-checking (tsc --noEmit) ──────────────────────")
    run(["npx", "tsc", "--noEmit"])

    action = "Serving" if args.serve else "Building"

    print(f"\n── Step 2: {action} webpack bundle ({args.mode}) ─────────────")
    env = {**os.environ, "MEMORY_PROFILER": "1" if args.mpr else ""}
    webpack_cmd = ["npx", "webpack", "serve"] if args.serve else ["npx", "webpack"]
    run([*webpack_cmd, "--mode", args.mode, *extra_args], env=env)

    if not args.serve:
        print(f"\n✓ JS build complete ({args.mode}).")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        # Ctrl+C during --serve: webpack-dev-server already prints its own graceful-shutdown
        # message and exits; avoid a redundant Python traceback on top of it.
        sys.exit(130)
