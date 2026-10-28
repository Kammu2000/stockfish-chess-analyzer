export const DEFAULT_DEPTH = 15;
export const DEPTH_OPTIONS = [10, 12, 15, 18, 22];

export const ENGINE_POOL_SIZE =
    typeof navigator !== "undefined"
        ? Math.max(2, Math.min(navigator.hardwareConcurrency / 2, 8))
        : 4;

export const CP_CEILING = 1000;
export const WIN_CHANCE_COEFFICIENT = 0.00368208;

// Expected points: 0..1 score expectation for a cp eval, 1 / (1 + e^(-gradient × cp)).
export const EXPECTED_POINTS_CP_GRADIENT = 0.0035;

// chess.com's published expected-points-lost upper bounds per class (above MISTAKE = Blunder).
export const EXCELLENT_MAX_LOSS = 0.02;
export const GOOD_MAX_LOSS = 0.05;
export const INACCURACY_MAX_LOSS = 0.1;
export const MISTAKE_MAX_LOSS = 0.2;

// Lost a forced mate: graded by the mover's surviving cp eval (≥ value).
export const MATE_LOST_EXCELLENT_CP = 800;
export const MATE_LOST_GOOD_CP = 400;
export const MATE_LOST_INACCURACY_CP = 200;
export const MATE_LOST_MISTAKE_CP = 0;

// Walked into a forced mate: graded by how soon it lands (mate in ≤ N moves).
export const MATE_ALLOWED_BLUNDER_MOVES = 2;
export const MATE_ALLOWED_MISTAKE_MOVES = 5;

// Winning mate flipped into a losing one: Mistake if the mate against is longer than this.
export const MATE_FLIPPED_MISTAKE_MOVES = 3;

// Kept a winning mate but made it longer by fewer than N moves.
export const MATE_DELAY_EXCELLENT_MOVES = 2;
export const MATE_DELAY_GOOD_MOVES = 7;

// MultiPV 2: runner-up line, needed for Critical ("only move") detection.
export const MULTI_PV = 2;
export const CRITICAL_RUNNER_UP_SAFE_CP = 700;
// Expected points the runner-up move would have lost (midway between Inaccuracy and Mistake).
export const CRITICAL_THRESHOLD = 0.1;

// Lichess per-move accuracy: 103.1668 × exp(−0.04354 × winPercentDrop) − 3.1669 (+1 bonus).
export const ACC_SCALE = 103.1668100711649;
export const ACC_RATE = 0.04354415386753951;
export const ACC_OFFSET = 3.166924740191411;
// Uncertainty bonus for imperfect analysis.
export const ACC_UNCERTAINTY_BONUS = 1;

// Volatility window (in positions) for weighting moves: game length / 10, clamped.
export const ACC_WINDOW_MIN = 2;
export const ACC_WINDOW_MAX = 8;
// Bounds for a window's win-% standard deviation used as a move's weight.
export const ACC_WEIGHT_MIN = 0.5;
export const ACC_WEIGHT_MAX = 12;
