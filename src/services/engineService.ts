// utils
import { parseEngineOutput } from "../utils/parseEngineOutput";

// types
import { AnalysisResult } from "../types";
import { WorkerResult, PendingResolve, PendingReject } from "./types";

const normalizeScore = (fen: string, result: AnalysisResult): void => {
    // Rationale: Stockfish scores are from the side-to-move's POV. Convert to White-absolute
    // so all scores in the rest of the app share the same sign convention.
    const sideToMove = fen.split(" ")[1];

    if (sideToMove === "b") {
        result.scoreCP = -result.scoreCP;
        if (result.scoreMate !== undefined) result.scoreMate = -result.scoreMate;
    }
};

class EngineService {
    private worker: Worker;
    private pendingMessages = new Map<number, { resolve: PendingResolve; reject: PendingReject }>();

    private readyPromise: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (err: Error) => void;

    public isReady = false;

    constructor() {
        this.readyPromise = new Promise((res, rej) => {
            this.readyResolve = res;
            this.readyReject = rej;
        });

        this.worker = this.createWorker();
    }

    private createWorker(): Worker {
        const worker = new Worker(new URL("../workers/stockfish.worker.ts", import.meta.url));
        worker.onmessage = this.onWorkerMessage;
        worker.onerror = this.onWorkerError;
        return worker;
    }

    private onWorkerMessage = (e: MessageEvent<WorkerResult>): void => {
        const msg = e.data;

        switch (msg.type) {
            case "ready": {
                this.isReady = true;
                this.readyResolve();
                break;
            }
            case "error": {
                this.readyReject(new Error(msg.message));
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
            this.readyReject(new Error(err.message || "Stockfish worker crashed during startup"));
        }
    };

    private sendMessageToWorker(message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = Date.now();
            this.pendingMessages.set(id, { resolve, reject });
            this.worker.postMessage({ type: "message", id, message });
        });
    }

    // publis methods
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
