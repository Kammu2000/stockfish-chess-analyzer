// constants
import {
    CLASSIFICATION_THRESHOLDS,
    WIN_P_COEFFICIENT,
    ACC_SCALE,
    ACC_RATE,
    ACC_OFFSET,
} from "../constants/analysis";

// types
import { MoveClass, ClassifiedMove, MoveNode } from "../types";

export const classifyDelta = (delta: number, isBrilliant = false): MoveClass => {
    if (isBrilliant) return MoveClass.Brilliant;
    for (const [threshold, label] of CLASSIFICATION_THRESHOLDS) {
        if (delta < threshold) return label;
    }
    return MoveClass.Blunder;
};

export const buildClassifiedMoves = (
    moves: MoveNode[],
    evalsBefore: number[],
    evalsAfter: number[],
    bestMoves: string[],
    bestEvals: number[],
    pvsAfter: string[][]
): ClassifiedMove[] => {
    return moves.map((move, i) => {
        const evalBefore = evalsBefore[i];
        const evalAfter = evalsAfter[i];
        const bestMove = bestMoves[i];
        const bestEvalBefore = bestEvals[i];

        const delta =
            move.color === "w"
                ? Math.max(0, bestEvalBefore - evalAfter)
                : Math.max(0, evalAfter - bestEvalBefore);

        const isBrilliant =
            delta > 50 &&
            (move.color === "w" ? evalAfter > evalBefore + 50 : evalAfter < evalBefore - 50) &&
            move.uci !== bestMove;

        const classification = classifyDelta(Math.round(delta), isBrilliant);

        return {
            ...move,
            evalBefore,
            evalAfter,
            bestMove,
            bestEvalBefore,
            delta: Math.round(delta),
            classification,
            pvAfter: pvsAfter[i] ?? [],
        };
    });
};

const winPercentage = (cp: number): number =>
    50 + 50 * (2 / (1 + Math.exp(-WIN_P_COEFFICIENT * cp)) - 1);

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
