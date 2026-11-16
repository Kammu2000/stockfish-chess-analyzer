// services
import { engineService } from "../services/engineService";

/**
 * Mounts the emscripten-memory-profiler floating panel, but only in builds compiled with
 * `--mpr` (scripts/build_js.py sets __MEMORY_PROFILER__ via webpack DefinePlugin). A normal
 * build never evaluates the dynamic imports below, so the profiler UI/CSS are excluded from
 * the default bundle.
 *
 * The engine pool runs ENGINE_POOL_SIZE independent Wasm instances, each with its own heap;
 * this panel only visualizes worker 0's instance, which is representative since every worker
 * is loaded from the same module with the same NNUE/analysis workload.
 */
export const initMemoryProfilerPanel = (): void => {
    if (!__MEMORY_PROFILER__) return;

    void Promise.all([
        import("emscripten-memory-profiler/ui"),
        import("emscripten-memory-profiler/styles.css"),
    ]).then(([{ default: MemoryProfilerUI }]) => {
        const ui = new MemoryProfilerUI({ injectStyles: false, title: "Stockfish Memory" });
        engineService.onMemoryProfilerSnapshot((workerIndex, snapshot) => {
            if (workerIndex === 0) ui.update(snapshot);
        });
    });
};
