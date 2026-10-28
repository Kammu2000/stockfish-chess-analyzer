// libs
import { Chess } from "chess.js";

// hooks
import { useAnalysisStore } from "./analysisStore";
import { currentRef, useGameStore } from "./gameStore";
import { useUiStore } from "./uiStore";

// services
import { engineService } from "../services/engineService";

// utils
import { buildClassifiedMoves } from "../utils/moveClassifier";
import { loadOpeningBook } from "../utils/opening";
import { childVariationIds, fenAt, moveAt } from "../utils/variations";

// types
import { AnalysisStatus, MoveNode, PositionEval, PositionRef } from "../types";

// In-flight evaluations, so a move played on top of a still-evaluating one can wait for it.
const evalPromises = new Map<string, Promise<PositionEval | null>>();

const evalBefore = async (parent: PositionRef): Promise<PositionEval | null> => {
    if (parent.kind === "var") {
        const node = useGameStore.getState().variations[parent.id];
        return node?.evalAfter ?? (await evalPromises.get(parent.id)) ?? null;
    }
    const { phase } = useAnalysisStore.getState();
    return phase.status === AnalysisStatus.Done
        ? (phase.positionEvals[parent.ply + 1] ?? null)
        : null;
};

const evaluateVariation = async (id: string, parent: PositionRef, move: MoveNode) => {
    const { updateVariation } = useGameStore.getState();

    const evalAfterPromise = engineService
        .analyzePosition(move.fen, useAnalysisStore.getState().depth)
        .then(
            (r): PositionEval => ({
                score: r.score,
                secondScore: r.secondScore,
                bestMove: r.bestMove,
                pv: r.pv,
            })
        );
    evalPromises.set(
        id,
        evalAfterPromise.catch(() => null)
    );

    try {
        const [before, after, lookupOpening] = await Promise.all([
            evalBefore(parent),
            evalAfterPromise,
            loadOpeningBook().catch(() => undefined),
        ]);
        if (!before) throw new Error("Previous position has no evaluation");

        const [result] = buildClassifiedMoves([move], [before, after], lookupOpening);
        updateVariation(id, { status: "done", evalAfter: after, result });
    } catch (err) {
        console.error("[variations]", err);
        updateVariation(id, { status: "error" });
    } finally {
        evalPromises.delete(id);
    }
};

/**
 * Plays `uci` (e.g. "e2e4", "e7e8q") from `from`. Re-uses the main-line move or an existing
 * variation when it's the same move; otherwise creates a variation node and evaluates/classifies
 * it in the background. Returns false for an illegal move.
 */
export const playMoveAt = (from: PositionRef, uci: string): boolean => {
    const game = useGameStore.getState();
    const fenBefore = fenAt(game.game, game.variations, from);

    const board = new Chess(fenBefore);
    let played;
    try {
        played = board.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
        });
    } catch {
        return false;
    }
    const normalizedUci = played.from + played.to + (played.promotion ?? "");

    if (from.kind === "main" && game.game?.moves[from.ply + 1]?.uci === normalizedUci) {
        game.goToPly(from.ply + 1);
        return true;
    }
    const existing = childVariationIds(game.variations, from).find(
        (id) => game.variations[id].move.uci === normalizedUci
    );
    if (existing) {
        game.goToVariation(existing);
        return true;
    }

    const parentMove = moveAt(game.game, game.variations, from);
    const move: MoveNode = {
        san: played.san,
        uci: normalizedUci,
        fen: board.fen(),
        fenBefore,
        ply: parentMove ? parentMove.ply + 1 : 0,
    };

    const id = game.addVariation(from, move);
    useUiStore.getState().setActiveTab("analysis");
    void evaluateVariation(id, from, move);
    return true;
};

export const playMove = (uci: string): boolean =>
    playMoveAt(currentRef(useGameStore.getState()), uci);
