// types
import { Score, Color } from "../types";

export const invertScore = (score: Score): Score =>
    score.kind === "cp" ? { kind: "cp", cp: -score.cp } : { kind: "mate", mate: -score.mate };

// The score as seen by `color`, instead of always White-absolute.
export const povScore = (score: Score, color: Color): Score =>
    color === "w" ? score : invertScore(score);

export const formatScore = (score: Score): string => {
    if (score.kind === "mate") return `M${Math.abs(score.mate)}`;
    const pawns = Math.abs(score.cp) / 100;
    return (score.cp >= 0 ? "+" : "-") + pawns.toFixed(2);
};
