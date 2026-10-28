// utils
import { parseEngineOutput } from "../utils/parseEngineOutput";
import { invertScore } from "../utils/score";
import { fetchWithProgress } from "../utils/utils";

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

class EngineWorker {
    private worker: Worker;
    private nextId = 0;
    private pendingMessages = new Map<number, { resolve: PendingResolve; reject: PendingReject }>();

    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (err: Error) => void;

    // Serialises analyzePosition calls: "position" + "go" must not interleave with another
    // caller's pair on the same worker (e.g. a variation evaluated while a batch is running).
    private analysisLock: Promise<unknown> = Promise.resolve();

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

    private sendAssets(assetsPromise: Promise<EngineAssets>): void {
        assetsPromise
            .then((payload) => this.worker.postMessage({ type: "assets", payload }))
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
                this.lastError = msg.payload.message || "Unknown engine error";
                this.readyReject(new Error(this.lastError));
                break;
            }
            case "result":
                {
                    const pending = this.pendingMessages.get(msg.payload.id);

                    if (pending) {
                        this.pendingMessages.delete(msg.payload.id);
                        pending.resolve(msg.payload.output);
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
            this.worker.postMessage({ type: "message", payload: { id, message } });
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

    analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
        const run = async (): Promise<AnalysisResult> => {
            await this.sendMessage(`position fen ${fen}`);
            const raw = await this.sendMessage(`go depth ${depth}`);

            const result = parseEngineOutput(raw);
            normalizeScore(fen, result);
            return result;
        };

        const next = this.analysisLock.then(run, run);
        this.analysisLock = next.catch(() => undefined);
        return next;
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

    /** Analyzes a single position (e.g. a user-played variation move). */
    async analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
        const [result] = await this.analyzeBatch([fen], depth);
        if (!result) throw new Error("Engine returned no result");
        return result;
    }
}

export const engineService = new EngineService();
