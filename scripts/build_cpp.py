#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Builds Stockfish to WebAssembly, producing two variants:
  - stockfish.{js,wasm,data}      "rich": full strength, both NNUE nets (~93MB download)
  - stockfish-lite.{js,wasm,data} "lite": small net only (~5MB download), used by default

Run via npm (forwards args after --), e.g.:
  npm run build-cpp                 # builds both variants (default)
  npm run build-cpp -- --lite       # builds only the lite variant
  npm run build-cpp -- --rich       # builds only the rich (full strength) variant
  npm run build-cpp -- --debug      # debug build (combine with --lite/--rich as needed)
Requires: emsdk already present in ./emsdk
"""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build Stockfish to WebAssembly (lite and/or rich variants)."
    )
    parser.add_argument(
        "--lite",
        action="store_true",
        help="Build only the lite variant (small NNUE net only, ~5MB download).",
    )
    parser.add_argument(
        "--rich",
        action="store_true",
        help="Build only the rich variant (both NNUE nets, ~93MB download).",
    )
    parser.add_argument("--debug", action="store_true", help="Debug build instead of release.")
    args = parser.parse_args()

    # Neither flag (or both) means "build everything", same as the default.
    args.build_rich = not args.lite or args.rich
    args.build_lite = not args.rich or args.lite
    return args


ARGS = parse_args()
IS_DEBUG_MODE = ARGS.debug
BUILD_RICH = ARGS.build_rich
BUILD_LITE = ARGS.build_lite

REPO_ROOT = Path(__file__).resolve().parent.parent
ENGINE_DIR = REPO_ROOT / "engine"
BUILD_DIR = ENGINE_DIR / "build"
STOCKFISH_DIR = ENGINE_DIR / "stockfish"
STOCKFISH_SRC = STOCKFISH_DIR / "src"
PUBLIC_DIR = REPO_ROOT / "public"
EMSDK_DIR = REPO_ROOT / "emsdk"
EMSCRIPTEN_DIR = EMSDK_DIR / "upstream" / "emscripten"

NNUE_FILES = [
    {"name": "nn-f68ec79f0fe3.nnue", "sha12": "f68ec79f0fe3"},
    {"name": "nn-47fc8b7fff06.nnue", "sha12": "47fc8b7fff06"},
]
NNUE_BASE_URL = "https://tests.stockfishchess.org/api/nn"

# Patched in-place onto the Stockfish submodule for the lite build only, then reverted via
# `git checkout` afterwards (the submodule itself stays pinned/un-committed-to). The NNUE_LITE
# define makes evaluation always use the small net, since the lite build never downloads the
# big net file and would otherwise `exit()` when Engine::verify_networks() checks for it.
LITE_PATCHES = {
    STOCKFISH_SRC / "engine.cpp": (
        (
            "void Engine::verify_networks() const {\n"
            "    networks->big.verify(options[\"EvalFile\"], onVerifyNetworks);\n"
            "    networks->small.verify(options[\"EvalFileSmall\"], onVerifyNetworks);\n"
        ),
        (
            "void Engine::verify_networks() const {\n"
            "#ifndef NNUE_LITE\n"
            "    networks->big.verify(options[\"EvalFile\"], onVerifyNetworks);\n"
            "#endif\n"
            "    networks->small.verify(options[\"EvalFileSmall\"], onVerifyNetworks);\n"
        ),
    ),
    STOCKFISH_SRC / "evaluate.cpp": (
        (
            "    bool smallNet           = use_smallnet(pos);\n"
            "    auto [psqt, positional] = smallNet ? networks.small.evaluate(pos, accumulators, caches.small)\n"
            "                                       : networks.big.evaluate(pos, accumulators, caches.big);\n"
            "\n"
            "    Value nnue = (125 * psqt + 131 * positional) / 128;\n"
            "\n"
            "    // Re-evaluate the position when higher eval accuracy is worth the time spent\n"
            "    if (smallNet && (std::abs(nnue) < 277))\n"
            "    {\n"
            "        std::tie(psqt, positional) = networks.big.evaluate(pos, accumulators, caches.big);\n"
            "        nnue                       = (125 * psqt + 131 * positional) / 128;\n"
            "        smallNet                   = false;\n"
            "    }\n"
        ),
        (
            "    Value psqt{}, positional{};\n"
            "    bool  smallNet;\n"
            "\n"
            "#ifdef NNUE_LITE\n"
            "    // Lite build only ships the small net (no big-net file downloaded); always use it.\n"
            "    smallNet                   = true;\n"
            "    std::tie(psqt, positional) = networks.small.evaluate(pos, accumulators, caches.small);\n"
            "#else\n"
            "    smallNet                   = use_smallnet(pos);\n"
            "    std::tie(psqt, positional) = smallNet\n"
            "                                  ? networks.small.evaluate(pos, accumulators, caches.small)\n"
            "                                  : networks.big.evaluate(pos, accumulators, caches.big);\n"
            "#endif\n"
            "\n"
            "    Value nnue = (125 * psqt + 131 * positional) / 128;\n"
            "\n"
            "#ifndef NNUE_LITE\n"
            "    // Re-evaluate the position when higher eval accuracy is worth the time spent\n"
            "    if (smallNet && (std::abs(nnue) < 277))\n"
            "    {\n"
            "        std::tie(psqt, positional) = networks.big.evaluate(pos, accumulators, caches.big);\n"
            "        nnue                       = (125 * psqt + 131 * positional) / 128;\n"
            "        smallNet                   = false;\n"
            "    }\n"
            "#endif\n"
        ),
    ),
}


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


def apply_lite_patches():
    for path, (original, patched) in LITE_PATCHES.items():
        text = path.read_text()
        if original not in text:
            print(
                f"Lite patch target not found in {path} (Stockfish source drifted?)",
                file=sys.stderr,
            )
            sys.exit(1)
        path.write_text(text.replace(original, patched, 1))


def revert_lite_patches():
    run("git checkout -- src/engine.cpp src/evaluate.cpp", cwd=STOCKFISH_DIR)


def build_variant(lite):
    label = "lite" if lite else "rich"
    suffix = "-lite" if lite else ""
    print(f"\n── Building {label} variant ───────────────────────────────────")

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    run(
        f'emcmake cmake "{ENGINE_DIR}" -DCMAKE_BUILD_TYPE=Release '
        f"-DBUILD_DEBUG={'ON' if IS_DEBUG_MODE else 'OFF'} "
        f"-DNNUE_LITE={'ON' if lite else 'OFF'}",
        cwd=BUILD_DIR,
    )

    cores = get_core_count() // 2 or 1
    print(f"Using {cores} cores")
    run(f"emmake make -j{cores}", cwd=BUILD_DIR)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(BUILD_DIR / "stockfish.js", PUBLIC_DIR / f"stockfish{suffix}.js")
    shutil.copyfile(BUILD_DIR / "stockfish.wasm", PUBLIC_DIR / f"stockfish{suffix}.wasm")

    # --preload-file creates a .data bundle containing the NNUE file(s)
    data_file = BUILD_DIR / "stockfish.data"
    if data_file.exists():
        shutil.copyfile(data_file, PUBLIC_DIR / f"stockfish{suffix}.data")

    print(f"  ✓ stockfish{suffix}.{{js,wasm,data}} → public/")


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

    # Step 3+4: Configure + build each requested variant
    if BUILD_RICH:
        build_variant(lite=False)

    if BUILD_LITE:
        apply_lite_patches()
        try:
            build_variant(lite=True)
        finally:
            revert_lite_patches()

    print(
        """
            ✓ Build complete. Artifacts copied to public/
    """
    )


if __name__ == "__main__":
    main()
