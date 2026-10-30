// constants
import { EVAL_BAR_SATURATION_CP } from "../constants/board";

// types
import { Score, Color } from "../types";

export const invertScore = (score: Score): Score =>
    score.kind === "cp" ? { kind: "cp", cp: -score.cp } : { kind: "mate", mate: -score.mate };

export const scoreFor = (score: Score, color: Color): Score =>
    color === "w" ? score : invertScore(score);

export const isCheckmated = (score: Score): boolean => score.kind === "mate" && score.mate === 0;

export const formatScore = (score: Score): string => {
    if (score.kind === "mate") return `M${Math.abs(score.mate)}`;
    const pawns = Math.abs(score.cp) / 100;
    return (score.cp >= 0 ? "+" : "-") + pawns.toFixed(2);
};

export const scoreToWhitePercent = (score: Score): number => {
    if (score.kind === "mate") return score.mate > 0 ? 100 : 0;
    const clamped = Math.max(-EVAL_BAR_SATURATION_CP, Math.min(EVAL_BAR_SATURATION_CP, score.cp));
    return 50 + (clamped / EVAL_BAR_SATURATION_CP) * 50;
};
