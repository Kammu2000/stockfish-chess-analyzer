// libs
import { useCallback } from "react";

// components
import { MoveCell } from "./MoveCell";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useAnalysisStore } from "../../store/analysisStore";

// utils
import { getMovePairs } from "./utils";

// types
import { MoveNode } from "../../types";

export const MoveList = (): JSX.Element => {
    const game = useGameStore((s) => s.game);
    const currentPly = useGameStore((s) => s.currentPly);
    const results = useAnalysisStore((s) => s.results);
    const status = useAnalysisStore((s) => s.status);

    const renderMove = useCallback(
        (move: MoveNode | undefined): JSX.Element => (
            <td className="w-1/2 py-0.5">
                {move && (
                    <MoveCell
                        san={move.san}
                        ply={move.ply}
                        active={currentPly === move.ply}
                        classification={
                            status !== "idle" ? results[move.ply]?.classification : undefined
                        }
                    />
                )}
            </td>
        ),
        [currentPly, status, results]
    );

    if (!game) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
                Upload a PGN to see moves
            </div>
        );
    }

    const pairs = getMovePairs(game.moves);
    const resultStr = game.headers["Result"] ?? "";

    return (
        <div className="flex-1 overflow-y-auto px-1 space-y-0.5">
            <table className="w-full text-sm">
                <tbody>
                    {pairs.map((pair, rowIdx) => {
                        const moveNum = rowIdx + 1;

                        return (
                            <tr key={moveNum} className="hover:bg-surface/60">
                                <td className="w-7 text-right pr-2 text-muted text-xs py-0.5 select-none">
                                    {moveNum}.
                                </td>
                                {renderMove(pair.white)}
                                {renderMove(pair.black)}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {resultStr && <div className="text-center text-xs text-muted py-2">{resultStr}</div>}
        </div>
    );
};
