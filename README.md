# Stockfish Chess Analyzer

Browser-based chess game analyzer. Upload a PGN, and Stockfish (compiled to WebAssembly) evaluates
every position to classify each move and compute accuracy scores, similar to chess.com's game review.

## Prerequisites

- Node.js
- [uv](https://docs.astral.sh/uv/) (for build scripts)
- `npm run setup` — clones/activates the Emscripten version pinned in `.emscripten-version` and
  syncs the required `repos/` submodules (currently just Stockfish). Only needed for `build-cpp`.
- `npm run sync` — (re-)syncs the required `repos/` submodules on its own, cloning any that aren't
  checked out yet. Handy after a fresh clone or after pulling changes that add a new submodule.
- The private `repos/emscripten-memory-profiler` submodule is optional and skipped by both of the
  above — it's only synced on demand, by `npm run sync -- --mpr` (or `--all`) or automatically by
  `build-cpp -- --mpr` (see below).

## Commands

```bash
npm run setup           # one-time dev environment setup (emsdk + repos/ submodules)
npm run sync            # sync/clone repos/ submodules on their own
npm start              # dev server on :3000
npm run build-prod      # full rebuild: build-cpp then build-js-prod
npm run build-dev       # full rebuild (debug): build-cpp --debug then build-js-dev
npm run build-js-prod    # type-check + production webpack build
npm run build-js-dev     # type-check + development webpack build
npm run build-cpp        # recompile Stockfish -> WASM, both lite + rich variants
npm run build-cpp -- --lite   # only the lite variant (small NNUE net, ~5MB)
npm run build-cpp -- --rich   # only the rich variant (both NNUE nets, ~93MB) (-r)
npm run build-cpp -- --debug  # debug build (combine with --lite/--rich as needed)
npm run build-cpp -- --mpr    # link emscripten-memory-profiler (auto-syncs its private submodule)
npm run build-js-prod -- --mpr  # bundle the lazy-loaded memory-profiler dev panel
npm run build-openings   # regenerate the opening book (src/constants/openings.json)
npm run preview          # serve a production build
npm run format           # prettier + clang-format
npm run format:check     # check-only formatting
npm run tsc              # tsc --noEmit
npm run lint             # esLint
npm test                 # vitest unit tests (npm run test:watch for watch mode)
```

## License

[MIT](LICENSE)
