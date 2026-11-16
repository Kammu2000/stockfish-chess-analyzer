#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Syncs submodules under repos/, cloning any not yet checked out. Run: uv run scripts/sync.py
- required submodules are always synced
- optional ones (see OPTIONAL_SUBMODULES) are skipped unless opted into via their flag or --all
"""

import argparse
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Submodules skipped by default (e.g. private repos), keyed by the CLI flag that opts them in.
OPTIONAL_SUBMODULES = {
    "mpr": "repos/emscripten-memory-profiler",
}


def run(cmd, cwd=None):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=cwd)


def submodule_paths():
    # One "submodule.<name>.path <path>" line per configured submodule; keep only repos/*.
    result = subprocess.run(
        ["git", "config", "-f", ".gitmodules", "--get-regexp", "path"],
        check=True,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    paths = [line.split(" ", 1)[1] for line in result.stdout.strip().splitlines()]
    return [p for p in paths if p.startswith("repos/")]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mpr",
        action="store_true",
        help="Also sync the private repos/emscripten-memory-profiler submodule.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Sync every repos/ submodule, including optional ones.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    all_paths = submodule_paths()
    optional_paths = set(OPTIONAL_SUBMODULES.values())
    enabled_optional = {p for flag, p in OPTIONAL_SUBMODULES.items() if getattr(args, flag)}

    if args.all:
        paths = all_paths
    else:
        paths = [p for p in all_paths if p not in optional_paths or p in enabled_optional]

    skipped = [p for p in all_paths if p not in paths]

    if not paths:
        print("No submodules to sync.")
        return

    print("── Syncing submodules ───────────────────────────────────────────")
    for path in paths:
        print(f"  {path}")
    # .gitmodules sets update=none on optional submodules so CI's own recursive submodule
    # checkout skips them; override that here for any we're actually syncing.
    overrides = [f"submodule.{p}.update=checkout" for p in paths if p in optional_paths]
    git_config_args = [arg for p in overrides for arg in ("-c", p)]
    run(
        ["git", *git_config_args, "submodule", "update", "--init", "--recursive", "--", *paths],
        cwd=REPO_ROOT,
    )

    if skipped:
        path_to_flag = {p: flag for flag, p in OPTIONAL_SUBMODULES.items()}
        print("\nSkipped optional submodules (not needed for a default build):")
        for path in skipped:
            flag = path_to_flag.get(path)
            via = f"`npm run sync -- --{flag}`" if flag else "`npm run sync -- --all`"
            print(f"  {path} (sync with {via}, or `--all`)")

    print("\n✓ Submodules in sync.")


if __name__ == "__main__":
    main()
