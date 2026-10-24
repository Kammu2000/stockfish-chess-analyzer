// libs
import { JSX, useCallback, useEffect, useState } from "react";

// services & utils & helpers
import { engineService } from "../../services/engineService";

// constants
import { ENGINE_STATUS_STYLES, Status } from "./constants";

// types
import { LoadProgress } from "../../services/types";

const formatPercent = (loaded: number, total: number): string =>
    total > 0 ? `${Math.round((loaded / total) * 100)}%` : "0%";

export const EngineStatus = (): JSX.Element => {
    const [status, setStatus] = useState<Status>(Status.LOADING);
    const [progress, setProgress] = useState<LoadProgress | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const awaitReady = useCallback(() => {
        setProgress(null);
        engineService
            .ready()
            .then(() => setStatus(Status.READY))
            .catch((err: Error) => {
                setErrorMessage(err.message);
                setStatus(Status.ERROR);
            });
    }, []);

    useEffect(() => {
        const unsubscribe = engineService.onProgress(setProgress);
        awaitReady();
        return unsubscribe;
    }, [awaitReady]);

    const handleRetry = useCallback(() => {
        setStatus(Status.LOADING);
        setErrorMessage(null);
        engineService.retry();
        awaitReady();
    }, [awaitReady]);

    const { dot, label } = ENGINE_STATUS_STYLES[status];

    const progressLabel =
        status === Status.LOADING && progress
            ? `${label} ${formatPercent(progress.loaded, progress.total)}`
            : label;

    return (
        <div className="flex items-center gap-2 text-xs text-muted">
            <div className={`w-2 h-2 rounded-full ${dot}`} />
            <span title={errorMessage ?? undefined}>{progressLabel}</span>
            {status === Status.ERROR && (
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
