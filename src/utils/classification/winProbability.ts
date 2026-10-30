// utils
import { clamp } from "../utils";

// constants
import {
    CP_CEILING,
    EXPECTED_POINTS_CP_GRADIENT,
    WIN_CHANCE_COEFFICIENT,
} from "../../constants/analysis";

// types
import { Score } from "../../types";

// Two different curves, on purpose:
// - winPercent: Lichess's win %, used for accuracy so it follows Lichess's published formula.
// - expectedPoints: chess.com-style expected score, used for grading against chess.com's
//   published expected-points-lost thresholds.

// White's win % (0–100) for a White-absolute score. A forced mate counts as ±CP_CEILING.
export const winPercent = (score: Score): number => {
    const cp = score.kind === "mate" ? Math.sign(score.mate || 1) * CP_CEILING : score.cp;
    const ceiled = clamp(cp, -CP_CEILING, CP_CEILING);
    const winningChances = 2 / (1 + Math.exp(-WIN_CHANCE_COEFFICIENT * ceiled)) - 1;
    return 50 + 50 * winningChances;
};

// The mover's expected score (0 = loss, 1 = win) for an eval from their side. "Mate 0" only
// appears after the mover has just delivered mate, so it counts as a win.
export const expectedPoints = (pov: Score): number => {
    if (pov.kind === "mate") return pov.mate < 0 ? 0 : 1;
    return 1 / (1 + Math.exp(-EXPECTED_POINTS_CP_GRADIENT * pov.cp));
};

// How much of the mover's expected score was thrown away going from `before` to `after` (both
// from the mover's side); never negative.
export const expectedPointsLost = (before: Score, after: Score): number =>
    Math.max(0, expectedPoints(before) - expectedPoints(after));
