// libs
import { JSX } from "react";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useAnalysisStore } from "../../store/analysisStore";

// utils
import { formatScore, scoreToWhitePercent } from "../../utils/score";
import { formatUciLine, uciToSan } from "../../utils/notation";
import { colorFromPly } from "../../utils/ply";

// constants
import { ANNOTATION_CONFIG, CLASSIFICATION_PHRASE } from "../../constants/annotations";

// types
import { MoveClass, AnalysisStatus, ClassifiedMove, Opening, Score } from "../../types";

// White chip when White is better, black chip otherwise — like the eval bar.
const EvalChip = ({ score, whiteBetter }: { score: Score; whiteBetter: boolean }) => {
    const isMate0 = score.kind === "mate" && score.mate === 0;

    return (
        <span
            className={[
                "ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs font-mono font-semibold",
                whiteBetter ? "bg-white text-black" : "bg-black text-white border border-panel",
            ].join(" ")}
        >
            {isMate0 ? "#" : formatScore(score).replace(/^[+-]/, "")}
        </span>
    );
};

const OpeningFooter = ({ opening }: { opening: Opening }) => (
    <div className="border-t border-panel px-4 py-2 text-xs text-muted truncate">
        <span className="font-mono text-white/70 mr-1.5">{opening.eco}</span>
        {opening.name}
    </div>
);

// Nearest opening at or before `ply`, so the name stays visible after leaving book.
const nearestOpening = (results: ClassifiedMove[], ply: number): Opening | undefined => {
    for (let i = ply; i >= 0; i--) if (results[i]?.opening) return results[i].opening;
    return undefined;
};

export const MoveCard = (): JSX.Element | null => {
    const currentPly = useGameStore((s) => s.currentPly);
    const phase = useAnalysisStore((s) => s.phase);

    if (phase.status !== AnalysisStatus.Done) return null;

    if (currentPly < 0) {
        return (
            <div className="rounded-xl bg-surface/80 border border-panel px-4 py-3 shrink-0">
                <p className="text-sm text-white font-semibold">Starting position</p>
                <p className="text-xs text-muted mt-0.5">
                    Press → or click a move to step through.
                </p>
            </div>
        );
    }

    const move = phase.results[currentPly];
    if (!move) return null;

    const config = ANNOTATION_CONFIG[move.classification];
    const color = config?.color ?? "#fff";
    const mover = colorFromPly(move.ply);
    const isMate0 = move.scoreAfter.kind === "mate" && move.scoreAfter.mate === 0;
    const whiteBetter = isMate0 ? mover === "w" : scoreToWhitePercent(move.scoreAfter) >= 50;

    // No alternative to suggest if the played move was the top choice, forced, or book theory.
    const playedTopChoice = move.bestMove !== null && move.uci === move.bestMove;
    const showAlternative =
        !playedTopChoice &&
        move.classification !== MoveClass.Forced &&
        move.classification !== MoveClass.Theory;

    const bestSan = move.bestMove
        ? (uciToSan(move.fenBefore, move.bestMove) ?? move.bestMove)
        : "?";
    const continuation = formatUciLine(move.fen, move.pvAfter, 6);
    const opening = nearestOpening(phase.results, currentPly);

    return (
        <div
            className="rounded-xl bg-surface/80 border border-panel overflow-hidden shrink-0"
            style={{ borderLeft: `3px solid ${color}` }}
        >
            <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 min-w-0">
                    <img
                        src={`/icons/${move.classification}.svg`}
                        alt={config?.label}
                        width={24}
                        height={24}
                        className="shrink-0"
                    />
                    <p className="text-sm font-semibold truncate" style={{ color }}>
                        {move.san} {CLASSIFICATION_PHRASE[move.classification]}
                    </p>
                    <EvalChip score={move.scoreAfter} whiteBetter={whiteBetter} />
                </div>

                {showAlternative && (
                    <p className="text-xs text-muted">
                        Best was <span className="text-white font-semibold">{bestSan}</span>{" "}
                        <span className="font-mono">({formatScore(move.scoreBefore)})</span>
                    </p>
                )}

                {continuation && !isMate0 && (
                    <p className="text-xs text-muted">
                        <span className="text-white/80 mr-1">Line:</span>
                        {continuation}
                    </p>
                )}
            </div>

            {opening && <OpeningFooter opening={opening} />}
        </div>
    );
};
