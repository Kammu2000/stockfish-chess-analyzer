// libs
import { Chess } from "chess.js";

// utils
import { gradeByLoss } from "./gradeMove";
import { MoveContext, isOnlyGoodMove, isSacrifice, requiresThought } from "./specialMoves";
import { scoreFor } from "../score";
import { OpeningLookup } from "../opening";

// types
import { ClassifiedMove, Color, MoveClass, MoveNode, PositionEval } from "../../types";

const classifyMove = (
    move: MoveNode,
    evalBefore: PositionEval,
    evalAfter: PositionEval,
    isBookMove: boolean
): MoveClass => {
    const boardBefore = new Chess(move.fenBefore);

    // Forced beats Theory, so a forced recapture inside a book line still shows as Forced.
    if (boardBefore.moves().length <= 1) return MoveClass.Forced;
    if (isBookMove) return MoveClass.Theory;

    // Stockfish's "mate 0" after mate is a sentinel, not a mate-in-N, so read mate off the board.
    const boardAfter = new Chess(move.fenAfter);
    if (boardAfter.isCheckmate()) return MoveClass.Best;

    const played = new Chess(move.fenBefore).move(move.san);
    const color = played.color as Color;
    const ctx: MoveContext = {
        played,
        color,
        boardBefore,
        boardAfter,
        before: scoreFor(evalBefore.score, color),
        after: scoreFor(evalAfter.score, color),
        runnerUp: evalBefore.secondScore && scoreFor(evalBefore.secondScore, color),
    };

    const isEngineBest = move.uci === evalBefore.bestMove;
    const grade = isEngineBest ? MoveClass.Best : gradeByLoss(ctx.before, ctx.after);

    if (grade !== MoveClass.Best || !requiresThought(ctx)) return grade;
    if (isSacrifice(ctx)) return MoveClass.Brilliant;
    if (isEngineBest && isOnlyGoodMove(ctx)) return MoveClass.Critical;
    return MoveClass.Best;
};

export const buildClassifiedMoves = (
    moves: MoveNode[],
    posEvals: PositionEval[],
    lookupOpening: OpeningLookup
): ClassifiedMove[] =>
    moves.map((move, i) => {
        const evalBefore = posEvals[i];
        const evalAfter = posEvals[i + 1];
        const opening = lookupOpening(move.fenAfter);

        return {
            ...move,
            scoreBefore: evalBefore.score,
            scoreAfter: evalAfter.score,
            bestMove: evalBefore.bestMove,
            classification: classifyMove(move, evalBefore, evalAfter, opening !== undefined),
            pvAfter: evalAfter.pv ?? [],
            opening,
        };
    });
