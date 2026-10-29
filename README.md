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
npm run build           # full rebuild: build-cpp then build-js-prod
npm run build-js-prod    # type-check + production webpack build
npm run build-js-dev     # type-check + development webpack build
npm run build-cpp        # recompile Stockfish -> WASM (pass --debug for a debug build)
npm run build-openings   # regenerate the opening book (src/constants/openings.json)
npm run preview          # serve a production build
npm run format           # prettier + clang-format
npm run format:check     # check-only formatting
npm run tsc              # tsc --noEmit
npm run lint             # esLint
npm test                 # vitest unit tests (npm run test:watch for watch mode)
```

Unit tests (Vitest) live next to the code as `src/**/*.test.ts`. CI (GitHub Actions) runs
typecheck, lint, format check, tests and a production build on every PR and push to `main`.

## License

[MIT](LICENSE)
