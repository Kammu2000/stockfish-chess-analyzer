// types
import { ErrorCode } from "../utils/errors/appError";

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
    | { type: "panic"; payload: { message: string } };

export interface LoadProgress {
    loaded: number;
    total: number;
}

export type PendingResolve = (output: string) => void;
export type PendingReject = (err: Error) => void;
