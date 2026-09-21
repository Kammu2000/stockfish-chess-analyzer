// components
import { MoveAnnotation } from "./MoveAnnotation";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useAnalysisStore } from "../../store/analysisStore";

// utils
import { formatScore } from "../../utils/score";

// types
import { MoveClass } from "../../types";

export const MoveDetail = (): JSX.Element | null => {
    const currentPly = useGameStore((s) => s.currentPly);
    const phase = useAnalysisStore((s) => s.phase);

    if (phase.status !== "done" || currentPly < 0) return null;

    const move = phase.results[currentPly];
    if (!move) return null;

    const evalLabel = formatScore(move.scoreAfter);
    const bestLabel = formatScore(move.bestScoreBefore);

    // No alternative to suggest if the played move was already the top choice, or was forced.
    const playedTopChoice = move.bestMove !== null && move.uci === move.bestMove;
    const showAlternative = !playedTopChoice && move.classification !== MoveClass.Forced;

    return (
        <div className="rounded-xl bg-surface/80 border border-panel p-4 space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{move.san}</span>
                <MoveAnnotation classification={move.classification} />
                <span className="ml-auto text-xs font-mono text-accent">{evalLabel}</span>
            </div>

            {showAlternative && (
                <div className="text-xs text-muted space-y-0.5">
                    <p>
                        Best was{" "}
                        <span className="text-white font-mono">{move.bestMove ?? "?"}</span> (eval{" "}
                        {bestLabel})
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
