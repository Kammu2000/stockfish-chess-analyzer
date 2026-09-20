// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useGameStore } from "../../store/gameStore";

export const AnalysisProgress = (): JSX.Element | null => {
    const game = useGameStore((s) => s.game);

    const phase = useAnalysisStore((s) => s.phase);
    const cancel = useAnalysisStore((s) => s.cancelAnalysis);

    if (phase.status !== "analyzing") return null;

    const total = game?.moves.length ?? 0;
    const done = Math.round(phase.progress * total);
    const pct = Math.round(phase.progress * 100);

    return (
        <div className="rounded-xl bg-surface/80 border border-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Analyzing…</p>
                    <p className="text-xs text-muted">
                        Move {done} of {total} ({pct}%)
                    </p>
                </div>
                <button
                    onClick={cancel}
                    className="text-xs text-muted hover:text-accent transition-colors px-2 py-1 rounded"
                >
                    Cancel
                </button>
            </div>

            <div className="h-1.5 w-full rounded-full bg-panel overflow-hidden">
                <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
};
