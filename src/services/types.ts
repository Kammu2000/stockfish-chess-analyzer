// constants
import { SOUND_FILES } from "./constants";

// engine service types
export interface WorkerResult {
    type: "result" | "ready" | "error";
    id?: number;
    output?: string;
    message?: string;
}

export type PendingResolve = (output: string) => void;
export type PendingReject = (err: Error) => void;

// sound service types
export type SoundKey = keyof typeof SOUND_FILES;
