# Stockfish Chess Analyzer

Browser-based chess game analyzer. Upload a PGN, and Stockfish (compiled to WebAssembly) evaluates
every position to classify each move and compute accuracy scores, similar to chess.com's game review.

## Prerequisites

- Node.js
- [uv](https://docs.astral.sh/uv/) (for build scripts)
- `npm run setup` — clones/activates the Emscripten version pinned in `.emscripten-version` and
  inits the `engine/stockfish` submodule. Only needed for `build-cpp`.

## Commands

```bash
npm run setup           # one-time dev environment setup (emsdk + Stockfish submodule)
npm start              # dev server on :3000
npm run build-prod      # full rebuild: build-cpp then build-js-prod
npm run build-dev       # full rebuild (debug): build-cpp --debug then build-js-dev
npm run build-js-prod    # type-check + production webpack build
npm run build-js-dev     # type-check + development webpack build
npm run build-cpp        # recompile Stockfish -> WASM, both lite + rich variants
npm run build-cpp -- --lite   # only the lite variant (small NNUE net, ~5MB)
npm run build-cpp -- --rich   # only the rich variant (both NNUE nets, ~93MB)
npm run build-cpp -- --debug  # debug build (combine with --lite/--rich as needed)
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
