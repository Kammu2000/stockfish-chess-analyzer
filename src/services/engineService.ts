// utils
import { parseEngineOutput } from "../utils/parseEngineOutput";
import { invertScore } from "../utils/score";

// constants
import { MULTI_PV, ENGINE_POOL_SIZE } from "../constants/analysis";

// types
import { AnalysisResult } from "../types";
import { WorkerResult, PendingResolve, PendingReject, LoadProgress } from "./types";
import { EngineAssets } from "../workers/types";

const STOCKFISH_JS_PATH = "/stockfish.js";
const STOCKFISH_WASM_PATH = "/stockfish.wasm";
const STOCKFISH_DATA_PATH = "/stockfish.data";

// Stockfish scores are side-to-move-relative; convert to White-absolute here.
const normalizeScore = (fen: string, result: AnalysisResult): void => {
    const sideToMove = fen.split(" ")[1];
    if (sideToMove !== "b") return;

    result.score = invertScore(result.score);
    if (result.secondScore) result.secondScore = invertScore(result.secondScore);
};

// Fetches a URL once, reporting cumulative bytes loaded as it streams (Content-Length is the
// total). Used to get real download progress out of a plain `fetch`, matching what Emscripten's
// own (now-bypassed) package fetcher used to report.
const fetchWithProgress = async (
    url: string,
    onChunk: (loadedDelta: number, total: number) => void
): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`${response.status}: ${response.url}`);
    }

    const total = Number(response.headers.get("Content-Length") ?? 0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onChunk(value.length, total);
    }

    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes.buffer;
};

// Memoized across the whole module: however many EngineWorkers ask for these assets, the wasm
// binary + NNUE weights are fetched from the network exactly once and compiled once, instead of
// once per pool worker. See personal-docs/browser-caching-notes.md for why this matters.
let sharedAssetsPromise: Promise<EngineAssets> | null = null;

const loadSharedAssets = (onProgress: (progress: LoadProgress) => void): Promise<EngineAssets> => {
    if (!sharedAssetsPromise) {
        sharedAssetsPromise = (async () => {
            const totals = { wasm: 0, data: 0 };
            const loaded = { wasm: 0, data: 0 };
            const report = (): void =>
                onProgress({
                    loaded: loaded.wasm + loaded.data,
                    total: totals.wasm + totals.data,
                });

            const [wasmBuffer, dataBuffer, glueResponse] = await Promise.all([
                fetchWithProgress(STOCKFISH_WASM_PATH, (delta, total) => {
                    totals.wasm = total;
                    loaded.wasm += delta;
                    report();
                }),
                fetchWithProgress(STOCKFISH_DATA_PATH, (delta, total) => {
                    totals.data = total;
                    loaded.data += delta;
                    report();
                }),
                fetch(STOCKFISH_JS_PATH),
            ]);

            if (!glueResponse.ok) {
                throw new Error(`${glueResponse.status}: ${glueResponse.url}`);
            }

            // A single Blob URL, reused by every worker's `importScripts` call and by
            // Emscripten's own internal pthread-sub-worker spawn (`mainScriptUrlOrBlob`) —
            // without this, each of those would independently re-fetch the glue script.
            const glueScript = await glueResponse.blob();
            const glueScriptUrl = URL.createObjectURL(glueScript);

            const wasmModule = await WebAssembly.compile(wasmBuffer);
            return { wasmModule, dataBuffer, glueScriptUrl };
        })().catch((err) => {
            // Let a later retry() re-fetch instead of permanently caching a failure.
            sharedAssetsPromise = null;
            throw err;
        });
    }
    return sharedAssetsPromise;
};

/** One Stockfish worker + its own wasm/NNUE instance; owns request/response matching. */
class EngineWorker {
    private worker: Worker;
    private nextId = 0;
    private pendingMessages = new Map<number, { resolve: PendingResolve; reject: PendingReject }>();

    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (err: Error) => void;

    public isReady = false;
    public lastError: string | null = null;

    constructor(assetsPromise: Promise<EngineAssets>) {
        this.resetReadyPromise();
        this.worker = this.createWorker();
        this.sendAssets(assetsPromise);
    }

    private resetReadyPromise(): void {
        this.readyPromise = new Promise((res, rej) => {
            this.readyResolve = res;
            this.readyReject = rej;
        });
    }

    private createWorker(): Worker {
        const worker = new Worker(
            new URL(
                /* webpackChunkName: "stockfish_proxy" */ "../workers/stockfish.worker.ts",
                import.meta.url
            )
        );
        worker.onmessage = this.onWorkerMessage;
        worker.onerror = this.onWorkerError;
        return worker;
    }

    // Sent once the shared wasm/NNUE assets are ready; postMessage structured-clones the
    // ArrayBuffer (no `transfer` list), so the original stays usable for the next worker/retry.
    private sendAssets(assetsPromise: Promise<EngineAssets>): void {
        assetsPromise
            .then(({ wasmModule, dataBuffer, glueScriptUrl }) =>
                this.worker.postMessage({ type: "assets", wasmModule, dataBuffer, glueScriptUrl })
            )
            .catch((err: Error) => {
                this.lastError = err.message;
                this.readyReject(err);
            });
    }

    private onWorkerMessage = (e: MessageEvent<WorkerResult>): void => {
        const msg = e.data;

        switch (msg.type) {
            case "ready": {
                void this.sendMessage(`setoption name MultiPV value ${MULTI_PV}`).then(() => {
                    this.isReady = true;
                    this.readyResolve();
                });
                break;
            }
            case "error": {
                this.lastError = msg.message ?? "Unknown engine error";
                this.readyReject(new Error(this.lastError));
                break;
            }
            case "result":
                {
                    if (msg.id) {
                        const pending = this.pendingMessages.get(msg.id);

                        if (pending) {
                            this.pendingMessages.delete(msg.id);
                            pending.resolve(msg.output ?? "");
                        }
                    }
                }
                break;
        }
    };

    private onWorkerError = (err: ErrorEvent): void => {
        if (!this.isReady) {
            this.lastError = err.message || "Stockfish worker crashed during startup";
            this.readyReject(new Error(this.lastError));
        }
    };

    private sendMessage(message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.nextId;
            this.pendingMessages.set(id, { resolve, reject });
            this.worker.postMessage({ type: "message", id, message });
        });
    }

    ready(): Promise<void> {
        return this.readyPromise;
    }

    /** Tears down the worker and starts loading a fresh one. */
    retry(assetsPromise: Promise<EngineAssets>): void {
        this.worker.terminate();
        this.pendingMessages.clear();
        this.isReady = false;
        this.lastError = null;
        this.resetReadyPromise();
        this.worker = this.createWorker();
        this.sendAssets(assetsPromise);
    }

    async analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
        await this.sendMessage(`position fen ${fen}`);
        const raw = await this.sendMessage(`go depth ${depth}`);

        const result = parseEngineOutput(raw);
        normalizeScore(fen, result);
        return result;
    }
}

class EngineService {
    private readonly workers: EngineWorker[];
    private readonly progressListeners = new Set<(progress: LoadProgress) => void>();
    private assetsPromise: Promise<EngineAssets>;

    public lastError: string | null = null;

    constructor() {
        this.assetsPromise = this.loadAssets();
        this.workers = Array.from(
            { length: ENGINE_POOL_SIZE },
            () => new EngineWorker(this.assetsPromise)
        );
    }

    private loadAssets(): Promise<EngineAssets> {
        return loadSharedAssets((progress) =>
            this.progressListeners.forEach((listener) => listener(progress))
        );
    }

    onProgress(listener: (progress: LoadProgress) => void): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    retry(): void {
        this.lastError = null;
        this.assetsPromise = this.loadAssets();
        this.workers.forEach((w) => w.retry(this.assetsPromise));
    }

    async ready(): Promise<void> {
        try {
            await Promise.all(this.workers.map((w) => w.ready()));
        } catch (err) {
            this.lastError = this.workers.find((w) => w.lastError)?.lastError ?? String(err);
            throw err;
        }
    }

    /**
     * Analyzes independent positions using a shared worker queue for dynamic
     * load balancing.
     * `onProgress` fires as each individual position completes; `shouldCancel`
     * is polled between positions so callers can abort mid-batch.
     */
    async analyzeBatch(
        positions: string[],
        depth: number,
        onProgress?: (completed: number, total: number) => void,
        shouldCancel?: () => boolean
    ): Promise<(AnalysisResult | null)[]> {
        const results: (AnalysisResult | null)[] = new Array(positions.length).fill(null);
        let nextIndex = 0;
        let completed = 0;

        const runWorker = async (worker: EngineWorker) => {
            while (nextIndex < positions.length && !shouldCancel?.()) {
                const index = nextIndex++;

                results[index] = await worker.analyzePosition(positions[index], depth);

                onProgress?.(++completed, positions.length);
            }
        };

        await Promise.all(this.workers.map(runWorker));
        return results;
    }
}

export const engineService = new EngineService();
