// libs
import { Fragment, JSX, useCallback, useEffect } from "react";

// components
import { MoveCell } from "./MoveCell";
import { VariationLines } from "./VariationLines";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useAnalysisStore } from "../../store/analysisStore";

// utils
import { getMovePairs } from "./utils";
import { mainBranches } from "../../utils/variations";

// types
import { MoveNode, AnalysisStatus } from "../../types";

export const MoveList = (): JSX.Element => {
    const game = useGameStore((s) => s.game);
    const currentPly = useGameStore((s) => s.currentPly);
    const currentVarId = useGameStore((s) => s.currentVarId);
    const variations = useGameStore((s) => s.variations);
    const phase = useAnalysisStore((s) => s.phase);

    const renderMove = useCallback(
        (move: MoveNode | undefined): JSX.Element => (
            <td className="w-1/2 py-0.5">
                {move && (
                    <MoveCell
                        san={move.san}
                        ply={move.ply}
                        active={currentVarId === null && currentPly === move.ply}
                        classification={
                            phase.status === AnalysisStatus.Done
                                ? phase.results[move.ply]?.classification
                                : undefined
                        }
                    />
                )}
            </td>
        ),
        [currentPly, currentVarId, phase]
    );

    // Keep the active move visible while stepping through with keys/buttons.
    useEffect(() => {
        document
            .getElementById(currentVarId ? `var-${currentVarId}` : `move-${currentPly}`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [currentPly, currentVarId]);

    if (!game) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
                Upload a PGN to see moves
            </div>
        );
    }

    const pairs = getMovePairs(game.moves);
    const resultStr = game.headers["Result"] ?? "";

    // Variations branching at main-line ply p are alternatives to move p+1, so they're shown
    // under the row holding that move (row r holds moves 2r and 2r+1).
    const branchesForRow = (r: number) => [
        ...mainBranches(variations, 2 * r - 1),
        ...mainBranches(variations, 2 * r),
    ];
    // Variations from the final position have no row of their own.
    const trailingBranches =
        game.moves.length % 2 === 0 ? mainBranches(variations, game.moves.length - 1) : [];

    return (
        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-0.5">
            <table className="w-full text-sm">
                <tbody>
                    {pairs.map((pair, rowIdx) => {
                        const moveNum = rowIdx + 1;

                        const branches = branchesForRow(rowIdx);

                        return (
                            <Fragment key={moveNum}>
                                <tr className="hover:bg-surface/60">
                                    <td className="w-7 text-right pr-2 text-muted text-xs py-0.5 select-none">
                                        {moveNum}.
                                    </td>
                                    {renderMove(pair.white)}
                                    {renderMove(pair.black)}
                                </tr>
                                {branches.length > 0 && (
                                    <tr>
                                        <td colSpan={3}>
                                            <VariationLines roots={branches} />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
            {trailingBranches.length > 0 && <VariationLines roots={trailingBranches} />}
            {resultStr && <div className="text-center text-xs text-muted py-2">{resultStr}</div>}
        </div>
    );
};
