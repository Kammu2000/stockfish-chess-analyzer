// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useGameStore } from "../../store/gameStore";

const accuracyColor = (v: number): string =>
    v >= 80 ? "text-green-400" : v >= 60 ? "text-yellow-400" : "text-red-400";

export const AccuracyCard = (): JSX.Element | null => {
    const status = useAnalysisStore((s) => s.status);
    const whiteAccuracy = useAnalysisStore((s) => s.whiteAccuracy);
    const blackAccuracy = useAnalysisStore((s) => s.blackAccuracy);
    const game = useGameStore((s) => s.game);

    if (status !== "done" || whiteAccuracy === null || blackAccuracy === null) return null;

    const whiteName = game?.headers["White"] ?? "White";
    const blackName = game?.headers["Black"] ?? "Black";

    return (
        <div className="rounded-xl bg-surface/80 border border-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Accuracy
            </p>
            <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted truncate">{whiteName}</p>
                    <p
                        className={`text-2xl font-bold tabular-nums ${accuracyColor(whiteAccuracy)}`}
                    >
                        {whiteAccuracy.toFixed(1)}%
                    </p>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted truncate">{blackName}</p>
                    <p
                        className={`text-2xl font-bold tabular-nums ${accuracyColor(blackAccuracy)}`}
                    >
                        {blackAccuracy.toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>
    );
};
