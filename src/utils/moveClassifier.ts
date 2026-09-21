// libs
import { Chess, Square } from "chess.js";

// constants
import {
    CP_CEILING,
    WIN_CHANCE_COEFFICIENT,
    BLUNDER_THRESHOLD,
    MISTAKE_THRESHOLD,
    INACCURACY_THRESHOLD,
    EXCELLENT_THRESHOLD,
    GOOD_THRESHOLD,
    MATE_LOST_INACCURACY_CP,
    MATE_LOST_MISTAKE_CP,
    CRITICAL_RUNNER_UP_SAFE_CP,
    CRITICAL_THRESHOLD,
    ACC_SCALE,
    ACC_RATE,
    ACC_OFFSET,
} from "../constants/analysis";

// utils
import { povScore } from "./score";
import { getUnsafePieces, isPieceSafe, isPieceTrapped } from "./tactics";

// types
import { MoveClass, ClassifiedMove, MoveNode, Score, Color } from "../types";

// Algorithm: docs/move-classification.md

const winningChances = (score: Score): number => {
    const cp = score.kind === "mate" ? Math.sign(score.mate || 1) * CP_CEILING : score.cp;
    const ceiled = Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
    const chances = 2 / (1 + Math.exp(-WIN_CHANCE_COEFFICIENT * ceiled)) - 1;
    return Math.max(-1, Math.min(1, chances));
};

const winPercentage = (score: Score): number => 50 + 50 * winningChances(score);

// Winning-chances the mover gave up (positive = worse for them).
const winningChancesLostForMover = (scoreBefore: Score, scoreAfter: Score, color: Color): number =>
    winningChances(povScore(scoreBefore, color)) - winningChances(povScore(scoreAfter, color));

const classifyByWinningChancesLost = (chancesLost: number): MoveClass => {
    if (chancesLost >= BLUNDER_THRESHOLD) return MoveClass.Blunder;
    if (chancesLost >= MISTAKE_THRESHOLD) return MoveClass.Mistake;
    if (chancesLost >= INACCURACY_THRESHOLD) return MoveClass.Inaccuracy;
    if (chancesLost >= GOOD_THRESHOLD) return MoveClass.Good;
    if (chancesLost >= EXCELLENT_THRESHOLD) return MoveClass.Excellent;
    return MoveClass.Best;
};

// null = mate merely delayed/shortened, not created or lost: no judgement.
const classifyMateTransition = (
    scoreBefore: Score,
    scoreAfter: Score,
    color: Color
): MoveClass | null => {
    const before = povScore(scoreBefore, color);
    const after = povScore(scoreAfter, color);

    if (before.kind === "cp" && after.kind === "mate" && after.mate < 0) {
        if (before.cp < -MATE_LOST_INACCURACY_CP) return MoveClass.Inaccuracy;
        if (before.cp < -MATE_LOST_MISTAKE_CP) return MoveClass.Mistake;
        return MoveClass.Blunder;
    }

    const moverHadWinningMate = before.kind === "mate" && before.mate > 0;
    const moverStillHasWinningMate = after.kind === "mate" && after.mate > 0;
    if (moverHadWinningMate && !moverStillHasWinningMate) {
        const survivingCp = after.kind === "cp" ? after.cp : 0;
        if (survivingCp > MATE_LOST_INACCURACY_CP) return MoveClass.Inaccuracy;
        if (survivingCp > MATE_LOST_MISTAKE_CP) return MoveClass.Mistake;
        return MoveClass.Blunder;
    }

    return null;
};

const isPromotionToQueen = (move: MoveNode): boolean =>
    move.uci.length === 5 && move.uci.endsWith("q");

// Grabbing already-hanging material isn't critical or brilliant — just the obvious move.
const capturesFreeMaterial = (move: MoveNode): boolean => {
    const board = new Chess(move.fenBefore);
    const to = move.uci.slice(2, 4) as Square;
    const captured = board.get(to);
    if (!captured || captured.color === move.color) return false;
    return !isPieceSafe(board, { ...captured, square: to });
};

// Candidate for "critical"/"brilliant": not forced, not a foregone conclusion (a safe
// alternative keeps the game just as won), not losing, not a queen promo, not free material.
// Mirrors wintrchess's isMoveCriticalCandidate.
const isCriticalCandidate = (
    move: MoveNode,
    scoreAfter: Score,
    runnerUpScoreBefore: Score | undefined,
    inCheckBefore: boolean
): boolean => {
    if (inCheckBefore || isPromotionToQueen(move) || capturesFreeMaterial(move)) return false;

    const povAfter = povScore(scoreAfter, move.color);
    if (
        (povAfter.kind === "cp" && povAfter.cp < 0) ||
        (povAfter.kind === "mate" && povAfter.mate < 0)
    ) {
        return false;
    }

    // Still comfortably winning even without finding this exact move.
    const reference = runnerUpScoreBefore ? povScore(runnerUpScoreBefore, move.color) : povAfter;
    if (reference.kind === "cp" && reference.cp >= CRITICAL_RUNNER_UP_SAFE_CP) return false;

    return true;
};

// The runner-up line was significantly worse — genuinely hard to find, not just "the best move."
// Mirrors wintrchess's considerCriticalClassification.
const isCritical = (
    move: MoveNode,
    scoreBefore: Score,
    runnerUpScoreBefore: Score | undefined,
    candidate: boolean
): boolean => {
    if (!candidate || !runnerUpScoreBefore) return false;
    return (
        winningChancesLostForMover(scoreBefore, runnerUpScoreBefore, move.color) >=
        CRITICAL_THRESHOLD
    );
};

// A real sacrifice: leaves a piece genuinely hanging, not a retreat to safety, not a piece that
// was doomed anyway. Mirrors wintrchess's considerBrilliantClassification.
const isBrilliant = (move: MoveNode, isBestTier: boolean, candidate: boolean): boolean => {
    if (!isBestTier || !candidate) return false;

    const boardBefore = new Chess(move.fenBefore);
    const boardAfter = new Chess(move.fen);

    const previousUnsafe = getUnsafePieces(boardBefore, move.color);
    const unsafe = getUnsafePieces(boardAfter, move.color);

    // Moving to safety without giving check can't be a sacrifice.
    if (!boardAfter.isCheck() && unsafe.length < previousUnsafe.length) return false;

    const previousTrapped = previousUnsafe.filter((piece) => isPieceTrapped(boardBefore, piece));
    const trapped = unsafe.filter((piece) => isPieceTrapped(boardAfter, piece));
    const fromSquare = move.uci.slice(0, 2);
    const movedPieceWasTrapped = previousTrapped.some((piece) => piece.square === fromSquare);

    // No real risk if every unsafe piece was doomed anyway, or trapped pieces didn't increase.
    if (
        trapped.length === unsafe.length ||
        movedPieceWasTrapped ||
        trapped.length < previousTrapped.length
    ) {
        return false;
    }

    return unsafe.length > 0;
};

export const buildClassifiedMoves = (
    moves: MoveNode[],
    scoresBefore: Score[],
    scoresAfter: Score[],
    bestMoves: (string | null)[],
    pvsAfter: string[][],
    runnerUpScoresBefore: (Score | undefined)[]
): ClassifiedMove[] => {
    return moves.map((move, i) => {
        const scoreBefore = scoresBefore[i];
        const scoreAfter = scoresAfter[i];
        const bestMove = bestMoves[i];
        const runnerUpScoreBefore = runnerUpScoresBefore[i];
        // scoreBefore already assumes the best move was played.
        const bestScoreBefore = scoreBefore;

        const isBestMove = bestMove !== null && move.uci === bestMove;
        const boardBefore = new Chess(move.fenBefore);

        let classification: MoveClass;

        if (boardBefore.moves().length <= 1) {
            classification = MoveClass.Forced;
        } else if (new Chess(move.fen).isCheckmate()) {
            // Stockfish's "mate 0" is a terminal sentinel, not a real mate-in-N value, so detect
            // the win directly from the position instead.
            classification = MoveClass.Best;
        } else {
            const mateJudgement = classifyMateTransition(scoreBefore, scoreAfter, move.color);

            if (mateJudgement) {
                classification = mateJudgement;
            } else if (scoreBefore.kind === "cp" && scoreAfter.kind === "cp") {
                classification = isBestMove
                    ? MoveClass.Best
                    : classifyByWinningChancesLost(
                          winningChancesLostForMover(scoreBefore, scoreAfter, move.color)
                      );
            } else {
                classification = isBestMove ? MoveClass.Best : MoveClass.Excellent;
            }

            const candidate = isCriticalCandidate(
                move,
                scoreAfter,
                runnerUpScoreBefore,
                boardBefore.isCheck()
            );

            if (isBestMove && isCritical(move, scoreBefore, runnerUpScoreBefore, candidate)) {
                classification = MoveClass.Critical;
            }

            const isBestTier =
                classification === MoveClass.Best || classification === MoveClass.Critical;

            if (isBrilliant(move, isBestTier, candidate)) {
                classification = MoveClass.Brilliant;
            }
        }

        return {
            ...move,
            scoreBefore,
            scoreAfter,
            bestMove,
            bestScoreBefore,
            classification,
            pvAfter: pvsAfter[i] ?? [],
        };
    });
};

export const computeAccuracy = (classifiedMoves: ClassifiedMove[], color: Color): number => {
    const own = classifiedMoves.filter((m) => m.color === color);
    if (own.length === 0) return 100;

    const avgDrop =
        own.reduce((sum, m) => {
            const before = winPercentage(povScore(m.scoreBefore, color));
            const after = winPercentage(povScore(m.scoreAfter, color));
            return sum + Math.max(0, before - after);
        }, 0) / own.length;

    const acc = ACC_SCALE * Math.exp(-ACC_RATE * avgDrop) - ACC_OFFSET;
    return Math.max(0, Math.min(100, Math.round(acc * 10) / 10));
};
