// types
import { ErrorCode } from "../utils/errors/appError";
import { MemorySnapshot } from "emscripten-memory-profiler";

export interface WorkerResultPayload {
    id: number;
    output: string;
}

export interface WorkerErrorPayload {
    code: ErrorCode;
    message: string;
}

export type WorkerResult =
    | { type: "ready" }
    | { type: "result"; payload: WorkerResultPayload }
    | { type: "error"; payload: WorkerErrorPayload }
    | { type: "panic"; payload: { message: string } }
    /*
     * Only sent when the worker/engine were both built with the memory-profiler flag
     * (see scripts/build_cpp.py --mpr and scripts/build_js.py --mpr).
     */
    | { type: "memoryProfilerSnapshot"; payload: MemorySnapshot };

export interface LoadProgress {
    loaded: number;
    total: number;
}

export type PendingResolve = (output: string) => void;
export type PendingReject = (err: Error) => void;
