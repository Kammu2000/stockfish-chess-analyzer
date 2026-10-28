// libs
import { JSX } from "react";
import { Chessboard, Arrow } from "react-chessboard";

// components
import { AnnotatedSquare } from "./AnnotatedSquare";
import { EvaluationBar } from "./EvaluationBar";
import { PlayerTag } from "./PlayerTag";

// contexts
import { AnnotationContext } from "../../contexts/AnnotationContext";

// hooks
import { AnalysisState, useAnalysisStore } from "../../store/analysisStore";
import { GameState, useGameStore } from "../../store/gameStore";

// constants
import { START_FEN } from "../../constants/board";

// types
import { AnalysisPhase, AnalysisStatus, MoveClass, ParsedGame, Score } from "../../types";

export const ChessBoard = (): JSX.Element => {
    const currentPly = useGameStore((s: GameState): number => s.currentPly);
    const game = useGameStore((s: GameState): ParsedGame | null => s.game);
    const flipped = useGameStore((s: GameState): boolean => s.flipped);
    const phase = useAnalysisStore((s: AnalysisState): AnalysisPhase => s.phase);

    const fen = currentPly < 0 || !game ? START_FEN : (game.moves[currentPly]?.fen ?? START_FEN);

    const currentResult =
        phase.status === AnalysisStatus.Done && currentPly >= 0 ? phase.results[currentPly] : null;
    const arrows: Arrow[] = [];

    if (currentResult && currentResult.bestMove !== null) {
        const startSquare = currentResult.bestMove.slice(0, 2);
        const endSquare = currentResult.bestMove.slice(2, 4);
        arrows.push({ startSquare, endSquare, color: "#22c55e" });
    }

    const destSquare = currentResult ? (game?.moves[currentPly]?.uci.slice(2, 4) ?? null) : null;
    const classification: MoveClass | null = currentResult?.classification ?? null;

    const score: Score = currentResult?.scoreAfter ?? { kind: "cp", cp: 0 };
    const orientation = flipped ? "black" : "white";

    return (
        <AnnotationContext.Provider value={{ destSquare, classification }}>
            <div
                className={`flex flex-col gap-1.5 w-full ${
                    game ? "max-w-[calc(100vh-280px)]" : "max-w-[calc(100vh-220px)]"
                }`}
            >
                {/* pl-7 = eval bar (w-5) + gap (gap-2), so tags line up with the board edge */}
                {game && (
                    <div className="pl-7">
                        <PlayerTag color={flipped ? "w" : "b"} headers={game.headers} />
                    </div>
                )}
                <div className="flex gap-2 items-stretch w-full">
                    <EvaluationBar score={score} orientation={orientation} />
                    <div className="flex-1 min-w-0">
                        <Chessboard
                            options={{
                                id: "chess-analyzer-board",
                                position: fen,
                                boardOrientation: orientation,
                                allowDragging: false,
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
                    </div>
                </div>
                {game && (
                    <div className="pl-7">
                        <PlayerTag color={flipped ? "b" : "w"} headers={game.headers} />
                    </div>
                )}
            </div>
        </AnnotationContext.Provider>
    );
};
