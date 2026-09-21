export const DEFAULT_DEPTH = 15;

export const DEPTH_OPTIONS = [10, 12, 15, 18, 22];

// See docs/move-classification.md for the algorithm these constants implement.
export const CP_CEILING = 1000;
export const WIN_CHANCE_COEFFICIENT = 0.00368208;

export const BLUNDER_THRESHOLD = 0.3;
export const MISTAKE_THRESHOLD = 0.2;
export const INACCURACY_THRESHOLD = 0.1;
export const EXCELLENT_THRESHOLD = 0.02;
export const GOOD_THRESHOLD = 0.05;

export const MATE_LOST_INACCURACY_CP = 999;
export const MATE_LOST_MISTAKE_CP = 700;

// MultiPV 2: runner-up line, needed for Critical ("only move") detection.
export const MULTI_PV = 2;
export const CRITICAL_RUNNER_UP_SAFE_CP = 700;
export const CRITICAL_THRESHOLD = 0.1;

// Lichess accuracy formula: 103.1668 × exp(−0.04354 × avgWinProbDrop) − 3.1669
export const ACC_SCALE = 103.1668;
export const ACC_RATE = 0.04354;
export const ACC_OFFSET = 3.1669;
