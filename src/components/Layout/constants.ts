export enum Status {
    LOADING = "loading",
    READY = "ready",
    ERROR = "error",
}

export const ENGINE_STATUS_STYLES: Record<Status, { dot: string; label: string }> = {
    [Status.LOADING]: {
        dot: "bg-yellow-400 animate-pulse",
        label: "Engine loading…",
    },
    [Status.READY]: {
        dot: "bg-green-400",
        label: "Engine ready",
    },
    [Status.ERROR]: {
        dot: "bg-red-400",
        label: "Engine failed",
    },
};
