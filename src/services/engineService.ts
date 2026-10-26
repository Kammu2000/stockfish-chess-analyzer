// utils
import { parseEngineOutput } from "../utils/parseEngineOutput";
import { invertScore } from "../utils/score";

// constants
import { MULTI_PV, ENGINE_POOL_SIZE } from "../constants/analysis";

// types
import { AnalysisResult } from "../types";
import { WorkerResult, PendingResolve, PendingReject, LoadProgress } from "./types";

// Stockfish scores are side-to-move-relative; convert to White-absolute here.
const normalizeScore = (fen: string, result: AnalysisResult): void => {
    const sideToMove = fen.split(" ")[1];
    if (sideToMove !== "b") return;

    result.score = invertScore(result.score);
    if (result.secondScore) result.secondScore = invertScore(result.secondScore);
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
    public lastProgress: LoadProgress = { loaded: 0, total: 0 };

    constructor(private readonly onProgress: (progress: LoadProgress) => void) {
        this.resetReadyPromise();
        this.worker = this.createWorker();
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
            case "progress": {
                if (msg.loaded === undefined || msg.total === undefined) break;
                this.lastProgress = { loaded: msg.loaded, total: msg.total };
                this.onProgress(this.lastProgress);
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
    retry(): void {
        this.worker.terminate();
        this.pendingMessages.clear();
        this.isReady = false;
        this.lastError = null;
        this.lastProgress = { loaded: 0, total: 0 };
        this.resetReadyPromise();
        this.worker = this.createWorker();
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

    public lastError: string | null = null;

    constructor() {
        this.workers = Array.from(
            { length: ENGINE_POOL_SIZE },
            () => new EngineWorker((progress) => this.handleWorkerProgress(progress))
        );
    }

    // Aggregates every pool worker's load progress into one,
    // so callers can show one progress bar regardless of pool size.
    private handleWorkerProgress(_progress: LoadProgress): void {
        const aggregate = this.workers.reduce(
            (acc, w) => ({
                loaded: acc.loaded + w.lastProgress.loaded,
                total: acc.total + w.lastProgress.total,
            }),
            { loaded: 0, total: 0 }
        );
        this.progressListeners.forEach((listener) => listener(aggregate));
    }

    onProgress(listener: (progress: LoadProgress) => void): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    retry(): void {
        this.lastError = null;
        this.workers.forEach((w) => w.retry());
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
