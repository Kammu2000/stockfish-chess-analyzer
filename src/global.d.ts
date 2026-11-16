/*
 * Injected by webpack.config.js (DefinePlugin) at build time: the URL path for each Stockfish
 * asset, content-hashed in production so CDN/browser caching stays safe across rebuilds, and
 * left as plain /stockfish*.{js,wasm,data} paths in dev (served unmodified from public/).
 */
declare const __STOCKFISH_ASSETS__: Record<
    "lite" | "rich",
    { js: string; wasm: string; data: string }
>;

/*
 * Injected by webpack.config.js (DefinePlugin): true when built with `--mpr` (scripts/build_js.py),
 * i.e. the engine was also linked with emscripten-memory-profiler. Gates the lazy-loaded dev panel.
 */
declare const __MEMORY_PROFILER__: boolean;

/*
 * tsconfig uses classic "node" moduleResolution (see webpack.config.js's ts-loader options), which
 * can't resolve emscripten-memory-profiler's types unless its optional submodule is checked out
 * (see scripts/sync.py). Declare the minimal surface area used by this repo so `tsc`/CI pass
 * whether or not the (private) submodule is present.
 */
declare module "emscripten-memory-profiler" {
    export interface MemorySnapshot {
        [key: string]: unknown;
    }
    export interface MemoryProfiler {
        readonly MESSAGE_TYPE: string;
        getSnapshot(): MemorySnapshot | null;
        start(callback?: (snapshot: MemorySnapshot) => void, intervalMs?: number): void;
        stop(): void;
        resetAllocationSites(): void;
        setThresholds(thresholds: Record<string, number>): void;
    }
}
declare module "emscripten-memory-profiler/ui" {
    import { MemoryProfilerUI } from "emscripten-memory-profiler";
    export default MemoryProfilerUI;
}
declare module "emscripten-memory-profiler/styles.css";
