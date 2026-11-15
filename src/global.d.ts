// Injected by webpack.config.js (DefinePlugin) at build time: the URL path for each Stockfish
// asset, content-hashed in production so CDN/browser caching stays safe across rebuilds, and
// left as plain /stockfish*.{js,wasm,data} paths in dev (served unmodified from public/).
declare const __STOCKFISH_ASSETS__: Record<
    "lite" | "rich",
    { js: string; wasm: string; data: string }
>;

// Injected by webpack.config.js (DefinePlugin): true when built with `--mpr` (scripts/build_js.py),
// i.e. the engine was also linked with emscripten-memory-profiler. Gates the lazy-loaded dev panel.
declare const __MEMORY_PROFILER__: boolean;

// tsconfig uses classic "node" moduleResolution (see webpack.config.js's ts-loader options), which
// doesn't understand emscripten-memory-profiler's package.json "exports" subpaths used for
// lazy-loading in src/devtools/memoryProfilerPanel.ts. The root import (MemorySnapshot etc.)
// resolves fine; only these two subpaths need a manual pointer to their real .d.ts files.
declare module "emscripten-memory-profiler/ui" {
    import { MemoryProfilerUI } from "emscripten-memory-profiler";
    export default MemoryProfilerUI;
}
declare module "emscripten-memory-profiler/styles.css";
