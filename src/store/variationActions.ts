// libs
import { Chess } from "chess.js";

// hooks
import { useAnalysisStore } from "./analysisStore";
import { currentRef, useGameStore } from "./gameStore";
import { useUiStore } from "./uiStore";

// services
import { engineService } from "../services/engineService";

// utils
import { buildClassifiedMoves } from "../utils/classification/classifyMoves";
import { AppError, toAppError } from "../utils/errors/appError";
import { playUciMove, toUci } from "../utils/notation";
import { loadOpeningBook, NO_OPENINGS } from "../utils/opening";
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

    const evalAfterPromise: Promise<PositionEval> = engineService.analyzePosition(
        move.fenAfter,
        useAnalysisStore.getState().depth
    );
    evalPromises.set(
        id,
        evalAfterPromise.catch(() => null)
    );

    try {
        const [before, after, lookupOpening] = await Promise.all([
            evalBefore(parent),
            evalAfterPromise,
            loadOpeningBook().catch(() => NO_OPENINGS),
        ]);
        if (!before) throw new AppError("MissingEvaluation", "Previous position has no evaluation");

        const [result] = buildClassifiedMoves([move], [before, after], lookupOpening);
        updateVariation(id, { status: "done", evalAfter: after, result });
    } catch (err) {
        if (toAppError(err, "Unknown").code === "Unknown") console.error("[variations]", err);
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
    const played = playUciMove(board, uci);
    if (!played) return false;
    const normalizedUci = toUci(played);

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
        fenAfter: board.fen(),
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
