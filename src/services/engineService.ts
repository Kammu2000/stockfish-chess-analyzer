// utils
import { panic, precondition, unreachable } from "../utils/errors/contract";
import { AppError, toAppError } from "../utils/errors/appError";
import { parseEngineOutput } from "../utils/parseEngineOutput";
import { invertScore } from "../utils/score";
import { fetchWithProgress } from "../utils/utils";

// constants
import { MULTI_PV, ENGINE_POOL_SIZE } from "../constants/analysis";

// types
import { AnalysisResult } from "../types";
import { WorkerResult, PendingResolve, PendingReject, LoadProgress } from "./types";
import { EngineAssets } from "../workers/types";

export type EngineVariant = "lite" | "rich";

const ASSET_PATHS: Record<EngineVariant, { js: string; wasm: string; data: string }> =
    __STOCKFISH_ASSETS__;

// Stockfish reports scores from the side to move's point of view.
const toWhiteAbsolute = (fen: string, result: AnalysisResult): AnalysisResult => {
    if (fen.split(" ")[1] !== "b") return result;
    return {
        ...result,
        score: invertScore(result.score),
        ...(result.secondScore && { secondScore: invertScore(result.secondScore) }),
    };
};

const loadAssets = async (
    variant: EngineVariant,
    onProgress: (progress: LoadProgress) => void
): Promise<EngineAssets> => {
    const paths = ASSET_PATHS[variant];

    try {
        const totals = { wasm: 0, data: 0 };
        const loaded = { wasm: 0, data: 0 };
        const report = (): void =>
            onProgress({
                loaded: loaded.wasm + loaded.data,
                total: totals.wasm + totals.data,
            });

        const [wasmBuffer, dataBuffer, glueResponse] = await Promise.all([
            fetchWithProgress(paths.wasm, (delta, total) => {
                totals.wasm = total;
                loaded.wasm += delta;
                report();
            }),
            fetchWithProgress(paths.data, (delta, total) => {
                totals.data = total;
                loaded.data += delta;
                report();
            }),
            fetch(paths.js),
        ]);

        if (!glueResponse.ok) {
            throw new AppError(
                "NetworkError",
                `Download failed (${glueResponse.status}): ${glueResponse.url}`
            );
        }

        const glueScript = await glueResponse.blob();
        const glueScriptUrl = URL.createObjectURL(glueScript);

        const wasmModule = await WebAssembly.compile(wasmBuffer);
        return { wasmModule, dataBuffer, glueScriptUrl };
    } catch (err) {
        throw toAppError(err, "EngineLoadFailed");
    }
};

interface Pending {
    resolve: PendingResolve;
    reject: PendingReject;
}

// Invariant: every promise handed out (ready() or a command) eventually settles. Once the
// worker fails, pending and later commands reject with that failure until retry().
class EngineWorker {
    private worker: Worker;
    private nextId = 0;
    private pendingMessages = new Map<number, Pending>();
    private failure: AppError | null = null;

    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (err: AppError) => void;

    // Serialises analyzePosition calls: "position" + "go" must not interleave with another
    // caller's pair on the same worker (e.g. a variation evaluated while a batch is running).
    private analysisLock: Promise<unknown> = Promise.resolve();

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
        // ready() may never be awaited (e.g. a worker that fails before anyone asks).
        this.readyPromise.catch(() => undefined);
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

    private async sendAssets(assetsPromise: Promise<EngineAssets>): Promise<void> {
        try {
            const payload = await assetsPromise;
            this.worker.postMessage({ type: "assets", payload });
        } catch (err) {
            this.fail(toAppError(err, "EngineLoadFailed"));
        }
    }

    private fail(err: AppError): void {
        this.failure = err;
        this.readyReject(err);
        this.rejectPending(err);
    }

    private rejectPending(err: AppError): void {
        const pending = [...this.pendingMessages.values()];
        this.pendingMessages.clear();
        pending.forEach((p) => p.reject(err));
    }

    private onWorkerMessage = (e: MessageEvent<WorkerResult>): void => {
        const msg = e.data;

        switch (msg.type) {
            case "ready":
                void (async () => {
                    try {
                        await this.sendMessage(`setoption name MultiPV value ${MULTI_PV}`);
                        this.readyResolve();
                    } catch (err) {
                        this.fail(toAppError(err, "EngineFailed"));
                    }
                })();
                break;
            case "error":
                this.fail(new AppError(msg.payload.code, msg.payload.message));
                break;
            case "panic":
                panic(`in the Stockfish worker: ${msg.payload.message}`);
                break;
            case "result": {
                const pending = this.pendingMessages.get(msg.payload.id);
                this.pendingMessages.delete(msg.payload.id);
                pending?.resolve(msg.payload.output);
                break;
            }
            default:
                unreachable(msg);
        }
    };

    private onWorkerError = (err: ErrorEvent): void => {
        this.fail(new AppError("EngineFailed", err.message || "Stockfish worker crashed"));
    };

    private sendMessage(message: string): Promise<string> {
        if (this.failure) return Promise.reject(this.failure);

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
        const restarted = new AppError("EngineRestarted", "Engine restarted");
        this.readyReject(restarted);
        this.rejectPending(restarted);
        this.failure = null;
        this.resetReadyPromise();
        this.worker = this.createWorker();
        this.sendAssets(assetsPromise);
    }

    analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
        const run = async (): Promise<AnalysisResult> => {
            await this.ready();
            await this.sendMessage(`position fen ${fen}`);
            const raw = await this.sendMessage(`go depth ${depth}`);
            return toWhiteAbsolute(fen, parseEngineOutput(raw));
        };

        const next = this.analysisLock.then(run, run);
        this.analysisLock = next.catch(() => undefined);
        return next;
    }
}

class EngineService {
    private readonly workers: EngineWorker[];
    private readonly progressListeners = new Set<(progress: LoadProgress) => void>();
    private readonly loadStartListeners = new Set<() => void>();
    // Cached per variant so switching back to a previously-loaded variant doesn't re-fetch it.
    private readonly assetsCache = new Map<EngineVariant, Promise<EngineAssets>>();
    private variant: EngineVariant = "lite";
    private assetsPromise: Promise<EngineAssets>;

    constructor() {
        this.assetsPromise = this.loadAssetsFor(this.variant);
        this.workers = Array.from(
            { length: ENGINE_POOL_SIZE },
            () => new EngineWorker(this.assetsPromise)
        );
    }

    private loadAssetsFor(variant: EngineVariant): Promise<EngineAssets> {
        const cached = this.assetsCache.get(variant);
        if (cached) return cached;

        const promise = loadAssets(variant, (progress) =>
            this.progressListeners.forEach((listener) => listener(progress))
        ).catch((err: unknown) => {
            this.assetsCache.delete(variant);
            throw err;
        });

        this.assetsCache.set(variant, promise);
        return promise;
    }

    onProgress(listener: (progress: LoadProgress) => void): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    /** Fires whenever the engine (re)enters a loading state, e.g. retry() or setVariant(). */
    onLoadStart(listener: () => void): () => void {
        this.loadStartListeners.add(listener);
        return () => this.loadStartListeners.delete(listener);
    }

    getVariant(): EngineVariant {
        return this.variant;
    }

    retry(): void {
        this.assetsCache.delete(this.variant);
        this.assetsPromise = this.loadAssetsFor(this.variant);
        this.loadStartListeners.forEach((listener) => listener());
        this.workers.forEach((w) => w.retry(this.assetsPromise));
    }

    setVariant(variant: EngineVariant): void {
        if (variant === this.variant) return;
        this.variant = variant;
        this.assetsPromise = this.loadAssetsFor(variant);
        this.loadStartListeners.forEach((listener) => listener());
        this.workers.forEach((w) => w.retry(this.assetsPromise));
    }

    /** Resolves once every worker has loaded; rejects with the first worker failure. */
    ready(): Promise<void> {
        return Promise.all(this.workers.map((w) => w.ready())).then(() => undefined);
    }

    /**
     * Analyzes independent positions on a shared worker queue (dynamic load balancing).
     * Resolves with one result per position, in order. Rejects with the first engine failure
     * (the other workers stop taking new positions) or with `signal.reason` once aborted.
     */
    async analyzeBatch(
        positions: string[],
        depth: number,
        onProgress?: (completed: number, total: number) => void,
        signal?: AbortSignal
    ): Promise<AnalysisResult[]> {
        precondition(
            Number.isInteger(depth) && depth > 0,
            `depth ${depth} must be a positive integer`
        );
        const results: AnalysisResult[] = new Array(positions.length);
        let nextIndex = 0;
        let completed = 0;
        let failed = false;

        const runWorker = async (worker: EngineWorker): Promise<void> => {
            while (nextIndex < positions.length && !failed) {
                signal?.throwIfAborted();
                const index = nextIndex++;
                try {
                    results[index] = await worker.analyzePosition(positions[index], depth);
                } catch (err) {
                    failed = true;
                    throw err;
                }
                onProgress?.(++completed, positions.length);
            }
        };

        await Promise.all(this.workers.map(runWorker));
        signal?.throwIfAborted();
        return results;
    }

    async analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
        const [result] = await this.analyzeBatch([fen], depth);
        return result;
    }
}

export const engineService = new EngineService();
