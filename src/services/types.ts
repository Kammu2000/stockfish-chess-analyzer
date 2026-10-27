// constants
import { SOUND_FILES } from "./constants";

// types
export interface WorkerResultPayload {
    id: number;
    output: string;
}

export interface WorkerErrorPayload {
    message: string;
}

export type WorkerResult =
    | { type: "ready" }
    | { type: "result"; payload: WorkerResultPayload }
    | { type: "error"; payload: WorkerErrorPayload };

export interface LoadProgress {
    loaded: number;
    total: number;
}

export type PendingResolve = (output: string) => void;
export type PendingReject = (err: Error) => void;

// sound service types
export type SoundKey = keyof typeof SOUND_FILES;
