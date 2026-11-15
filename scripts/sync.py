#!/usr/bin/env -S uv run
"""
Syncs every submodule under repos/ (cloning it if it isn't checked out yet, e.g.
repos/stockfish or the optional private repos/emscripten-memory-profiler).
Run from the repo root: uv run scripts/sync.py
Safe to re-run any time; also runs automatically as part of `npm run setup`.
"""

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def run(cmd, cwd=None):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=cwd)


def submodule_paths():
    # `git config -f .gitmodules --get-regexp path` prints one "submodule.<name>.path <path>"
    # line per configured submodule; we only want the ones that live under repos/.
    result = subprocess.run(
        ["git", "config", "-f", ".gitmodules", "--get-regexp", "path"],
        check=True,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    paths = [line.split(" ", 1)[1] for line in result.stdout.strip().splitlines()]
    return [p for p in paths if p.startswith("repos/")]


def main():
    paths = submodule_paths()
    if not paths:
        print("No submodules configured under repos/.")
        return

    print("── Syncing submodules ───────────────────────────────────────────")
    for path in paths:
        print(f"  {path}")
    run(["git", "submodule", "update", "--init", "--recursive", "--", *paths], cwd=REPO_ROOT)

    print("\n✓ Submodules in sync.")


if __name__ == "__main__":
    main()
