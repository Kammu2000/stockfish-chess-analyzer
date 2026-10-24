// constants
import { SOUND_FILES } from "./constants";

// types
export interface WorkerResult {
    type: "result" | "ready" | "error" | "progress";
    id?: number;
    output?: string;
    message?: string;
    loaded?: number;
    total?: number;
}

export interface LoadProgress {
    loaded: number;
    total: number;
}

export type PendingResolve = (output: string) => void;
export type PendingReject = (err: Error) => void;

// sound service types
export type SoundKey = keyof typeof SOUND_FILES;
