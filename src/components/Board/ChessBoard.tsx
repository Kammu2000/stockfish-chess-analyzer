// libs
import { Chessboard } from "react-chessboard";
import { Arrow } from "react-chessboard/dist/chessboard/types";

// components
import { AnalysisState, useAnalysisStore } from "../../store/analysisStore";
import AnnotatedSquare from "./AnnotatedSquare";
import EvaluationBar from "./EvaluationBar";
import { GameState, useGameStore } from "../../store/gameStore";

// contexts
import { AnnotationContext } from "../../contexts/AnnotationContext";

// constants
import { START_FEN } from "../../constants/board";

// types
import { AnalysisStatus, ClassifiedMove, MoveClass, ParsedGame } from "../../types";

export const ChessBoard = (): JSX.Element => {
    const currentPly = useGameStore((s: GameState): number => s.currentPly);
    const game = useGameStore((s: GameState): ParsedGame | null => s.game);
    const results = useAnalysisStore((s: AnalysisState): ClassifiedMove[] => s.results);
    const status = useAnalysisStore((s: AnalysisState): AnalysisStatus => s.status);

    const fen = currentPly < 0 || !game ? START_FEN : (game.moves[currentPly]?.fen ?? START_FEN);

    const currentResult = status === "done" && currentPly >= 0 ? results[currentPly] : null;
    const customArrows: Arrow[] = [];

    if (currentResult && currentResult.bestMove !== "(none)") {
        const from = currentResult.bestMove.slice(0, 2);
        const to = currentResult.bestMove.slice(2, 4);
        customArrows.push([from as Arrow[0], to as Arrow[1], "#22c55e"]);
    }

    const destSquare = currentResult ? (game?.moves[currentPly]?.uci.slice(2, 4) ?? null) : null;
    const classification: MoveClass | null = currentResult?.classification ?? null;

    const scoreCP = currentResult?.evalAfter ?? 0;
    const scoreMate = currentResult?.scoreMate;

    return (
        <AnnotationContext.Provider value={{ destSquare, classification }}>
            <div className="flex gap-2 items-stretch w-full max-w-[calc(100vh-220px)]">
                <EvaluationBar scoreCP={scoreCP} scoreMate={scoreMate} />
                <div className="flex-1 min-w-0">
                    <Chessboard
                        position={fen}
                        arePiecesDraggable={false}
                        customArrows={customArrows}
                        customSquare={AnnotatedSquare}
                        customBoardStyle={{
                            borderRadius: "4px",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                        }}
                        customDarkSquareStyle={{ backgroundColor: "#4a7fa5" }}
                        customLightSquareStyle={{ backgroundColor: "#d9e6f0" }}
                    />
                </div>
            </div>
        </AnnotationContext.Provider>
    );
};
