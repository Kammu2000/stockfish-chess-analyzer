// libs
import { JSX, useCallback, useEffect, useState } from "react";

// services & utils & helpers
import { engineService } from "../../services/engineService";

// constants
import { ENGINE_STATUS_STYLES, Status } from "./constants";

// types
import { LoadProgress } from "../../services/types";

const formatPercent = (loaded: number, total: number): string =>
    total > 0 ? `${Math.min(100, Math.round((loaded / total) * 100))}%` : "0%";

type EngineState =
    | { status: Status.LOADING; progress: LoadProgress | null }
    | { status: Status.READY }
    | { status: Status.ERROR; message: string };

export const EngineStatus = (): JSX.Element => {
    const [state, setState] = useState<EngineState>({ status: Status.LOADING, progress: null });

    const awaitReady = useCallback(() => {
        setState({ status: Status.LOADING, progress: null });
        engineService
            .ready()
            .then(() => setState({ status: Status.READY }))
            .catch((err: Error) => setState({ status: Status.ERROR, message: err.message }));
    }, []);

    useEffect(() => {
        const unsubscribe = engineService.onProgress((progress) =>
            setState((prev) =>
                prev.status === Status.LOADING ? { status: Status.LOADING, progress } : prev
            )
        );
        awaitReady();
        return unsubscribe;
    }, [awaitReady]);

    const handleRetry = useCallback(() => {
        engineService.retry();
        awaitReady();
    }, [awaitReady]);

    const { dot, label } = ENGINE_STATUS_STYLES[state.status];
    const errorMessage = state.status === Status.ERROR ? state.message : null;

    const progressLabel =
        state.status === Status.LOADING && state.progress
            ? `${label} ${formatPercent(state.progress.loaded, state.progress.total)}`
            : label;

    return (
        <div className="flex items-center gap-2 text-xs text-muted">
            <div className={`w-2 h-2 rounded-full ${dot}`} />
            <span title={errorMessage ?? undefined}>{progressLabel}</span>
            {state.status === Status.ERROR && (
                <button
                    onClick={handleRetry}
                    className="text-accent hover:underline"
                    title={errorMessage ?? "Retry loading the engine"}
                >
                    Retry
                </button>
            )}
        </div>
    );
};
