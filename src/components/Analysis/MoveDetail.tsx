// components
import { MoveAnnotation } from "./MoveAnnotation";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useAnalysisStore } from "../../store/analysisStore";

// types
import { MoveClass } from "../../types";

export const MoveDetail = (): JSX.Element | null => {
    const currentPly = useGameStore((s) => s.currentPly);
    const results = useAnalysisStore((s) => s.results);
    const status = useAnalysisStore((s) => s.status);

    if (status !== "done" || currentPly < 0) return null;

    const move = results[currentPly];
    if (!move) return null;

    const evalLabel =
        move.scoreMate !== undefined
            ? `M${Math.abs(move.scoreMate)}`
            : `${move.evalAfter >= 0 ? "+" : ""}${(move.evalAfter / 100).toFixed(2)}`;

    const bestLabel = `${(move.bestEvalBefore / 100).toFixed(2)}`;

    return (
        <div className="rounded-xl bg-surface/80 border border-panel p-4 space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{move.san}</span>
                <MoveAnnotation classification={move.classification} />
                <span className="ml-auto text-xs font-mono text-accent">{evalLabel}</span>
            </div>

            {move.classification !== MoveClass.Best &&
                move.classification !== MoveClass.Brilliant && (
                    <div className="text-xs text-muted space-y-0.5">
                        <p>
                            Best was <span className="text-white font-mono">{move.bestMove}</span>{" "}
                            (eval {bestLabel})
                        </p>
                    </div>
                )}

            {move.pvAfter.length > 0 && (
                <div className="text-xs text-muted">
                    <span className="text-white mr-1">Continuation:</span>
                    <span className="font-mono">{move.pvAfter.slice(0, 5).join(" ")}</span>
                </div>
            )}
        </div>
    );
};
