// libs
import { JSX } from "react";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";

// types
import { AnalysisStatus } from "../../types";

export const AnalysisError = (): JSX.Element | null => {
    const phase = useAnalysisStore((s) => s.phase);

    if (phase.status !== AnalysisStatus.Error) return null;

    return (
        <div className="rounded-xl bg-red-400/10 border border-red-400/30 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-red-400">Analysis failed</p>
            <p className="text-xs text-muted break-words">{phase.error}</p>
        </div>
    );
};
