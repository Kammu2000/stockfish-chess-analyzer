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
    ACC_SCALE,
    ACC_RATE,
    ACC_OFFSET,
} from "../constants/analysis";

// utils
import { povScore } from "./score";

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

// Winning-chances the mover gave up, from their own perspective (positive = worse for them).
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

// null = mate merely delayed/shortened, never actually created or lost: no judgement.
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

export const buildClassifiedMoves = (
    moves: MoveNode[],
    scoresBefore: Score[],
    scoresAfter: Score[],
    bestMoves: (string | null)[],
    pvsAfter: string[][]
): ClassifiedMove[] => {
    return moves.map((move, i) => {
        const scoreBefore = scoresBefore[i];
        const scoreAfter = scoresAfter[i];
        const bestMove = bestMoves[i];
        // scoreBefore already assumes optimal play, i.e. "score if best move had been played".
        const bestScoreBefore = scoreBefore;

        const isBestMove = bestMove !== null && move.uci === bestMove;
        const mateJudgement = classifyMateTransition(scoreBefore, scoreAfter, move.color);

        let classification: MoveClass;
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
