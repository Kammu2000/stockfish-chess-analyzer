# Stockfish Chess Analyzer

Browser-based chess game analyzer. Upload a PGN, and Stockfish (compiled to WebAssembly) evaluates
every position to classify each move (Best/Excellent/Good/Inaccuracy/Mistake/Blunder/Brilliant) and
compute accuracy scores, similar to chess.com's game review.

React + TypeScript frontend, Stockfish C++ engine cross-compiled to WebAssembly via Emscripten,
running in a Web Worker.

## Prerequisites

- Node.js
- [uv](https://docs.astral.sh/uv/) (for build scripts)
- Emscripten SDK in `./emsdk` and the `engine/stockfish` submodule — only needed for `build-cpp`
  (`git submodule update --init`)

## Commands

```bash
npm start              # dev server on :3000
npm run build           # full rebuild: build-cpp then build-js-prod
npm run build-js-prod    # type-check + production webpack build
npm run build-js-dev     # type-check + development webpack build
npm run build-cpp        # recompile Stockfish -> WASM (pass --debug for a debug build)
npm run preview          # serve a production build
npm run format           # prettier + clang-format
npm run format:check     # check-only formatting
```

There is no test suite configured in this repo currently.

## Docs

See `docs/js-cpp-bridge.md` for the JS/WASM memory flow.

## License

MIT
