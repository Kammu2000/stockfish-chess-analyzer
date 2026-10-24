// utils
import { parseEngineOutput } from "../utils/parseEngineOutput";
import { invertScore } from "../utils/score";

// constants
import { MULTI_PV } from "../constants/analysis";

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

class EngineService {
    private worker: Worker;
    private pendingMessages = new Map<number, { resolve: PendingResolve; reject: PendingReject }>();

    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (err: Error) => void;

    private progressListeners = new Set<(progress: LoadProgress) => void>();

    public isReady = false;
    public lastError: string | null = null;

    constructor() {
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
                void this.sendMessageToWorker(`setoption name MultiPV value ${MULTI_PV}`).then(
                    () => {
                        this.isReady = true;
                        this.readyResolve();
                    }
                );
                break;
            }
            case "error": {
                this.lastError = msg.message ?? "Unknown engine error";
                this.readyReject(new Error(this.lastError));
                break;
            }
            case "progress": {
                if (msg.loaded === undefined || msg.total === undefined) break;
                const progress = { loaded: msg.loaded, total: msg.total };
                this.progressListeners.forEach((listener) => listener(progress));
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

    onProgress(listener: (progress: LoadProgress) => void): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    /** Tears down the failed worker and starts loading a fresh one. */
    retry(): void {
        this.worker.terminate();
        this.pendingMessages.clear();
        this.isReady = false;
        this.lastError = null;
        this.resetReadyPromise();
        this.worker = this.createWorker();
    }

    private sendMessageToWorker(message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = Date.now();
            this.pendingMessages.set(id, { resolve, reject });
            this.worker.postMessage({ type: "message", id, message });
        });
    }

    ready(): Promise<void> {
        return this.readyPromise;
    }

    async analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
        await this.sendMessageToWorker(`position fen ${fen}`);
        const raw = await this.sendMessageToWorker(`go depth ${depth}`);

        const result = parseEngineOutput(raw);
        normalizeScore(fen, result);
        return result;
    }
}

export const engineService = new EngineService();
