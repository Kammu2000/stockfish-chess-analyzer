#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Builds Stockfish to WebAssembly.
Run from the repo root: uv run scripts/build_cpp.py [--debug]
Requires: emsdk already present in ./emsdk
"""

import hashlib
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

IS_DEBUG_MODE = "--debug" in sys.argv[1:]

REPO_ROOT = Path(__file__).resolve().parent.parent
ENGINE_DIR = REPO_ROOT / "engine"
BUILD_DIR = ENGINE_DIR / "build"
STOCKFISH_SRC = ENGINE_DIR / "stockfish" / "src"
PUBLIC_DIR = REPO_ROOT / "public"
EMSDK_DIR = REPO_ROOT / "emsdk"
EMSCRIPTEN_DIR = EMSDK_DIR / "upstream" / "emscripten"

NNUE_FILES = [
    {"name": "nn-f68ec79f0fe3.nnue", "sha12": "f68ec79f0fe3"},
    {"name": "nn-47fc8b7fff06.nnue", "sha12": "47fc8b7fff06"},
]
NNUE_BASE_URL = "https://tests.stockfishchess.org/api/nn"


# helpers
def run(cmd, cwd=None):
    print(f"\n$ {cmd}")
    env = {**os.environ, "PATH": f"{EMSCRIPTEN_DIR}{os.pathsep}{os.environ.get('PATH', '')}"}
    subprocess.run(cmd, shell=True, check=True, cwd=cwd, env=env)


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        shutil.copyfileobj(resp, f)


def sha256prefix12(file_path):
    return hashlib.sha256(Path(file_path).read_bytes()).hexdigest()[:12]


def get_core_count():
    return os.cpu_count() or 4


def main():
    # Step 1: Verify emsdk
    print("── Step 1: Verifying Emscripten ──────────────────────────────")
    emcc = EMSCRIPTEN_DIR / "emcc"

    if not emcc.exists():
        print(f"emcc not found at {emcc}", file=sys.stderr)
        print("Make sure emsdk is installed and activated in ./emsdk", file=sys.stderr)
        sys.exit(1)

    run(f'"{emcc}" --version')
    print(f"\nBuild mode: {'DEBUG 🐛' if IS_DEBUG_MODE else 'RELEASE 🚀'}")

    # Step 2: Download NNUE weight files
    print("\n── Step 2: Downloading NNUE weight files ─────────────────────")
    for nnue in NNUE_FILES:
        name, sha12 = nnue["name"], nnue["sha12"]
        dest = STOCKFISH_SRC / name

        if dest.exists():
            actual = sha256prefix12(dest)
            if actual == sha12:
                print(f"  {name}  already valid, skipping.")
                continue
            print(f"  {name}  checksum mismatch ({actual} ≠ {sha12}), re-downloading…")
        else:
            print(f"  Downloading {name}…")

        url = f"{NNUE_BASE_URL}/{name}"
        download(url, dest)
        actual = sha256prefix12(dest)

        if actual != sha12:
            print(f"  Checksum failed for {name}: got {actual}, expected {sha12}", file=sys.stderr)
            sys.exit(1)

        print(f"  {name}  ✓")

    # Step 3: CMake configure
    print("\n── Step 3: CMake configure ───────────────────────────────────")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    run(
        f'emcmake cmake "{ENGINE_DIR}" -DCMAKE_BUILD_TYPE=Release '
        f"-DBUILD_DEBUG={'ON' if IS_DEBUG_MODE else 'OFF'}",
        cwd=BUILD_DIR,
    )

    # Step 4: Build
    print("\n── Step 4: Building ──────────────────────────────────────────")
    cores = get_core_count() // 2 or 1
    print(f"Using {cores} cores")
    run(f"emmake make -j{cores}", cwd=BUILD_DIR)

    # Step 5: Copy artifacts
    print("\n── Step 5: Copying artifacts to public/ ──────────────────────")
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(BUILD_DIR / "stockfish.js", PUBLIC_DIR / "stockfish.js")
    shutil.copyfile(BUILD_DIR / "stockfish.wasm", PUBLIC_DIR / "stockfish.wasm")

    # --preload-file creates a .data bundle containing the NNUE files
    data_file = BUILD_DIR / "stockfish.data"
    if data_file.exists():
        shutil.copyfile(data_file, PUBLIC_DIR / "stockfish.data")
        print("  stockfish.data       → public/")

    # Emscripten pthreads builds emit a secondary worker JS file
    worker_file = BUILD_DIR / "stockfish.worker.js"
    if worker_file.exists():
        shutil.copyfile(worker_file, PUBLIC_DIR / "stockfish.worker.js")
        print("  stockfish.worker.js  → public/")

    print(f"""
✓ Build complete. Artifacts copied to public/
  stockfish.js   → {PUBLIC_DIR}/stockfish.js
  stockfish.wasm → {PUBLIC_DIR}/stockfish.wasm
  stockfish.data → {PUBLIC_DIR}/stockfish.data  (NNUE files)
""")


if __name__ == "__main__":
    main()
