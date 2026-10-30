// libs
import { Chess, Move } from "chess.js";

// utils
import { expectedPointsLost } from "./winProbability";
import { getCaptureSquare, opponent } from "../tactics/board";
import { getUnsafePieces, isPieceSafe } from "../tactics/safety";
import { everyCaptureBackfires, isPieceTrapped } from "../tactics/threats";

// constants
import { CRITICAL_RUNNER_UP_SAFE_CP, CRITICAL_THRESHOLD } from "../../constants/analysis";

// types
import { Color, Score } from "../../types";

// Everything the Critical/Brilliant checks need about one move. Scores are from the mover's side.
export interface MoveContext {
    played: Move;
    color: Color;
    boardBefore: Chess;
    boardAfter: Chess;
    before: Score;
    after: Score;
    runnerUp?: Score; // the engine's second-best line from the position before
}

const isLosing = (score: Score): boolean => (score.kind === "cp" ? score.cp : score.mate) < 0;

// Only a move that had to be found can be Critical or Brilliant: not an escape from check, not a
// queen promotion, not one that leaves the mover losing, and not one where the runner-up move
// would have kept a comfortable win anyway.
export const requiresThought = ({ played, boardBefore, after, runnerUp }: MoveContext): boolean => {
    const withoutThisMove = runnerUp ?? after;
    if (withoutThisMove.kind === "cp" && withoutThisMove.cp >= CRITICAL_RUNNER_UP_SAFE_CP) {
        return false;
    }

    return !isLosing(after) && played.promotion !== "q" && !boardBefore.isCheck();
};

const capturesHangingPiece = ({ played, color, boardBefore }: MoveContext): boolean =>
    played.captured !== undefined &&
    !isPieceSafe(boardBefore, {
        type: played.captured,
        color: opponent(color),
        square: getCaptureSquare(played),
    });

// Critical: the engine's move was the only good one, because the runner-up would have lost a lot.
export const isOnlyGoodMove = (ctx: MoveContext): boolean => {
    const { before, after, runnerUp } = ctx;
    if (!runnerUp) return false;

    // Keeping a forced mate you already had, or grabbing loose material, is the obvious move.
    if (after.kind === "mate" && after.mate > 0) return false;
    if (capturesHangingPiece(ctx)) return false;

    return expectedPointsLost(before, runnerUp) >= CRITICAL_THRESHOLD;
};

// Brilliant: a real sacrifice. After the move, a piece can be taken, and not because it moved
// into safety, the capture is a trap, or the piece was lost anyway.
export const isSacrifice = ({ played, color, boardBefore, boardAfter }: MoveContext): boolean => {
    if (played.promotion) return false;

    const unsafeAfter = getUnsafePieces(boardAfter, color, played);
    if (unsafeAfter.length === 0) return false;

    // Moving pieces out of danger (without giving check) isn't a sacrifice.
    const unsafeBefore = getUnsafePieces(boardBefore, color);
    if (!boardAfter.isCheck() && unsafeAfter.length < unsafeBefore.length) return false;

    // Every way of taking the offered piece costs the opponent at least as much.
    if (unsafeAfter.every((piece) => everyCaptureBackfires(boardAfter, piece))) return false;

    // Nothing is given up when the pieces were lost anyway.
    const trappedBefore = unsafeBefore.filter((piece) => isPieceTrapped(boardBefore, piece));
    const trappedAfter = unsafeAfter.filter((piece) => isPieceTrapped(boardAfter, piece));
    if (trappedAfter.length === unsafeAfter.length) return false;
    if (trappedBefore.some((piece) => piece.square === played.from)) return false;
    if (trappedAfter.length < trappedBefore.length) return false;

    return true;
};
