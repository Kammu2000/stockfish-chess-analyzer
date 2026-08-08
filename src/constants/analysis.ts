import { MoveClass } from "../types";

export const DEFAULT_DEPTH = 15;

export const DEPTH_OPTIONS = [10, 12, 15, 18, 22];

export const CLASSIFICATION_THRESHOLDS: [number, MoveClass][] = [
    [3, MoveClass.Best],
    [10, MoveClass.Excellent],
    [25, MoveClass.Good],
    [75, MoveClass.Inaccuracy],
    [150, MoveClass.Mistake],
    [Infinity, MoveClass.Blunder],
];

// Lichess logistic curve: converts centipawns to win probability (0–100)
export const WIN_P_COEFFICIENT = 0.00368208;

// Lichess accuracy formula: 103.1668 × exp(−0.04354 × avgWinProbDrop) − 3.1669
export const ACC_SCALE = 103.1668;
export const ACC_RATE = 0.04354;
export const ACC_OFFSET = 3.1669;
