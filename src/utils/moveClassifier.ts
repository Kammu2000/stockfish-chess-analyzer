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

// types
import { MoveClass, ClassifiedMove, MoveNode } from "../types";

// Algorithm: docs/move-classification.md

const winningChances = (cp: number): number => {
    const ceiled = Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
    const chances = 2 / (1 + Math.exp(-WIN_CHANCE_COEFFICIENT * ceiled)) - 1;
    return Math.max(-1, Math.min(1, chances));
};

const winPercentage = (cp: number): number => 50 + 50 * winningChances(cp);

// Winning-chances the mover gave up, from their own perspective (positive = worse for them).
const winningChancesLostForMover = (
    evalBeforeCp: number,
    evalAfterCp: number,
    color: "w" | "b"
): number => {
    const before = winningChances(evalBeforeCp);
    const after = winningChances(evalAfterCp);
    return color === "w" ? before - after : after - before;
};

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
    mateBefore: number | undefined,
    mateAfter: number | undefined,
    evalBeforeCp: number,
    evalAfterCp: number,
    color: "w" | "b"
): MoveClass | null => {
    const sign = color === "w" ? 1 : -1;
    const povMateBefore = mateBefore === undefined ? undefined : sign * mateBefore;
    const povMateAfter = mateAfter === undefined ? undefined : sign * mateAfter;
    const povEvalBefore = sign * evalBeforeCp;
    const povEvalAfter = sign * evalAfterCp;

    const mateCreatedAgainstMover = povMateBefore === undefined && (povMateAfter ?? 0) < 0;
    const mateLostByMover =
        povMateBefore !== undefined &&
        povMateBefore > 0 &&
        (povMateAfter === undefined || povMateAfter < 0);

    if (mateCreatedAgainstMover) {
        if (povEvalBefore < -MATE_LOST_INACCURACY_CP) return MoveClass.Inaccuracy;
        if (povEvalBefore < -MATE_LOST_MISTAKE_CP) return MoveClass.Mistake;
        return MoveClass.Blunder;
    }

    if (mateLostByMover) {
        const survivingCp = povMateAfter !== undefined ? 0 : povEvalAfter;
        if (survivingCp > MATE_LOST_INACCURACY_CP) return MoveClass.Inaccuracy;
        if (survivingCp > MATE_LOST_MISTAKE_CP) return MoveClass.Mistake;
        return MoveClass.Blunder;
    }

    return null;
};

export const buildClassifiedMoves = (
    moves: MoveNode[],
    evalsBefore: number[],
    evalsAfter: number[],
    bestMoves: string[],
    pvsAfter: string[][],
    scoreMatesBefore: (number | undefined)[],
    scoreMatesAfter: (number | undefined)[]
): ClassifiedMove[] => {
    return moves.map((move, i) => {
        const evalBefore = evalsBefore[i];
        const evalAfter = evalsAfter[i];
        const bestMove = bestMoves[i];
        const mateBefore = scoreMatesBefore[i];
        const mateAfter = scoreMatesAfter[i];
        // evalBefore already assumes optimal play, i.e. "eval if best move had been played".
        const bestEvalBefore = evalBefore;

        const isBestMove = move.uci === bestMove;
        const mateJudgement = classifyMateTransition(
            mateBefore,
            mateAfter,
            evalBefore,
            evalAfter,
            move.color
        );

        let classification: MoveClass;
        if (mateJudgement) {
            classification = mateJudgement;
        } else if (mateBefore === undefined && mateAfter === undefined) {
            classification = isBestMove
                ? MoveClass.Best
                : classifyByWinningChancesLost(
                      winningChancesLostForMover(evalBefore, evalAfter, move.color)
                  );
        } else {
            classification = isBestMove ? MoveClass.Best : MoveClass.Excellent;
        }

        return {
            ...move,
            evalBefore,
            evalAfter,
            bestMove,
            bestEvalBefore,
            classification,
            pvAfter: pvsAfter[i] ?? [],
            scoreMate: mateAfter,
        };
    });
};

export const computeAccuracy = (classifiedMoves: ClassifiedMove[], color: "w" | "b"): number => {
    const own = classifiedMoves.filter((m) => m.color === color);
    if (own.length === 0) return 100;

    const avgDrop =
        own.reduce((sum, m) => {
            const drop =
                color === "w"
                    ? winPercentage(m.evalBefore) - winPercentage(m.evalAfter)
                    : winPercentage(m.evalAfter) - winPercentage(m.evalBefore);
            return sum + Math.max(0, drop);
        }, 0) / own.length;

    const acc = ACC_SCALE * Math.exp(-ACC_RATE * avgDrop) - ACC_OFFSET;
    return Math.max(0, Math.min(100, Math.round(acc * 10) / 10));
};
