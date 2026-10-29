// libs
import { JSX, useMemo } from "react";
import { Chessboard, Arrow } from "react-chessboard";

// components
import { AnnotatedSquare } from "./AnnotatedSquare";
import { EvaluationBar } from "./EvaluationBar";
import { PlayerTag } from "./PlayerTag";
import { PromotionPicker } from "./PromotionPicker";

// contexts
import { AnnotationContext } from "../../contexts/AnnotationContext";

// hooks
import { AnalysisState, useAnalysisStore } from "../../store/analysisStore";
import { GameState, useGameStore } from "../../store/gameStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useBoardMoves } from "../../hooks/useBoardMoves";
import { useCurrentPosition } from "../../hooks/useCurrentPosition";
import { usePrevious } from "../../hooks/usePrevious";

// utils
import { involvesPromotion } from "../../utils/notation";

// types
import { AnalysisStatus, MoveClass, ParsedGame, Score } from "../../types";

export const ChessBoard = (): JSX.Element => {
    const game = useGameStore((s: GameState): ParsedGame | null => s.game);
    const flipped = useGameStore((s: GameState): boolean => s.flipped);
    const analysisDone = useAnalysisStore(
        (s: AnalysisState): boolean => s.phase.status === AnalysisStatus.Done
    );
    const showBestMoveArrow = useSettingsStore((s) => s.showBestMoveArrow);

    const { fen, move, result, score: positionScore } = useCurrentPosition();
    const interactive = !!game && analysisDone;
    const boardMoves = useBoardMoves(fen, interactive);

    // rationale: react-chessboard's promotion animation leaves an uncancelled timer that re-applies the
    // promoted position if the position changes again within the animation, so skip animating
    // promotions (and stepping back over them).
    const prevFen = usePrevious(fen);
    const animate = !prevFen || !involvesPromotion(prevFen, fen);

    const arrows: Arrow[] = [];

    if (showBestMoveArrow && result && result.bestMove !== null) {
        const startSquare = result.bestMove.slice(0, 2);
        const endSquare = result.bestMove.slice(2, 4);
        arrows.push({ startSquare, endSquare, color: "#22c55e" });
    }

    const destSquare = result ? (move?.uci.slice(2, 4) ?? null) : null;
    const classification: MoveClass | null = result?.classification ?? null;
    const squareStyles = boardMoves.squareStyles;
    const annotation = useMemo(
        () => ({ destSquare, classification, squareStyles }),
        [destSquare, classification, squareStyles]
    );

    const score: Score = positionScore ?? { kind: "cp", cp: 0 };
    const orientation = flipped ? "black" : "white";

    return (
        <AnnotationContext value={annotation}>
            {/* Height budget: header (~57px) + main padding (32px), plus both player tags (~60px). */}
            <div
                className={`flex flex-col gap-1.5 w-full ${
                    game ? "max-w-[calc(100vh-160px)]" : "max-w-[calc(100vh-100px)]"
                }`}
            >
                {game && (
                    <div className="pl-9">
                        <PlayerTag color={flipped ? "w" : "b"} headers={game.headers} />
                    </div>
                )}
                <div className="flex gap-2 items-stretch w-full">
                    <EvaluationBar score={score} orientation={orientation} />
                    <div className="relative flex-1 min-w-0">
                        <Chessboard
                            options={{
                                id: "chess-analyzer-board",
                                position: fen,
                                boardOrientation: orientation,
                                allowDragging: interactive,
                                showAnimations: animate,
                                canDragPiece: boardMoves.canDragPiece,
                                onPieceDrop: boardMoves.onPieceDrop,
                                onSquareClick: boardMoves.onSquareClick,
                                arrows,
                                squareRenderer: AnnotatedSquare,
                                boardStyle: {
                                    borderRadius: "4px",
                                    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                                },
                                darkSquareStyle: { backgroundColor: "#4a7fa5" },
                                lightSquareStyle: { backgroundColor: "#d9e6f0" },
                            }}
                        />
                        {boardMoves.promotion && (
                            <PromotionPicker
                                color={boardMoves.promotion.color}
                                onChoose={boardMoves.choosePromotion}
                                onCancel={boardMoves.cancelPromotion}
                            />
                        )}
                    </div>
                </div>
                {game && (
                    <div className="pl-9">
                        <PlayerTag color={flipped ? "b" : "w"} headers={game.headers} />
                    </div>
                )}
            </div>
        </AnnotationContext>
    );
};
