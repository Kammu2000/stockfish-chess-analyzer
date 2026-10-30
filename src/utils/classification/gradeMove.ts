// utils
import { expectedPointsLost } from "./winProbability";

// constants
import {
    EXCELLENT_MAX_LOSS,
    GOOD_MAX_LOSS,
    INACCURACY_MAX_LOSS,
    MISTAKE_MAX_LOSS,
    MATE_LOST_EXCELLENT_CP,
    MATE_LOST_GOOD_CP,
    MATE_LOST_INACCURACY_CP,
    MATE_LOST_MISTAKE_CP,
    MATE_ALLOWED_BLUNDER_MOVES,
    MATE_ALLOWED_MISTAKE_MOVES,
    MATE_FLIPPED_MISTAKE_MOVES,
    MATE_DELAY_EXCELLENT_MOVES,
    MATE_DELAY_GOOD_MOVES,
} from "../../constants/analysis";

// types
import { MoveClass, Score } from "../../types";

// Grades from best to worst, each with the limit a move must meet to earn it.
type GradeLadder = readonly (readonly [limit: number, grade: MoveClass])[];

const firstGradeMet = (
    ladder: GradeLadder,
    meets: (limit: number) => boolean,
    fallback: MoveClass
): MoveClass => ladder.find(([limit]) => meets(limit))?.[1] ?? fallback;

// By expected points lost (at most).
const EXPECTED_POINTS_LOSS: GradeLadder = [
    [0, MoveClass.Best],
    [EXCELLENT_MAX_LOSS, MoveClass.Excellent],
    [GOOD_MAX_LOSS, MoveClass.Good],
    [INACCURACY_MAX_LOSS, MoveClass.Inaccuracy],
    [MISTAKE_MAX_LOSS, MoveClass.Mistake],
];

// Had a forced mate, now only a cp eval: by the eval that's left (at least).
const MATE_LOST: GradeLadder = [
    [MATE_LOST_EXCELLENT_CP, MoveClass.Excellent],
    [MATE_LOST_GOOD_CP, MoveClass.Good],
    [MATE_LOST_INACCURACY_CP, MoveClass.Inaccuracy],
    [MATE_LOST_MISTAKE_CP, MoveClass.Mistake],
];

// Walked into a forced mate: by how soon it lands (in at most this many moves).
const MATE_ALLOWED: GradeLadder = [
    [MATE_ALLOWED_BLUNDER_MOVES, MoveClass.Blunder],
    [MATE_ALLOWED_MISTAKE_MOVES, MoveClass.Mistake],
];

// Still mating, but slower: by how many moves the mate was delayed (fewer than this).
const MATE_DELAYED: GradeLadder = [
    [MATE_DELAY_EXCELLENT_MOVES, MoveClass.Excellent],
    [MATE_DELAY_GOOD_MOVES, MoveClass.Good],
];

const gradeMateToMate = (mateBefore: number, mateAfter: number): MoveClass => {
    const mateFlipped = mateBefore > 0 && mateAfter < 0;
    if (mateFlipped) {
        return mateAfter < -MATE_FLIPPED_MISTAKE_MOVES ? MoveClass.Mistake : MoveClass.Blunder;
    }

    // The winner should bring mate one move closer; the defender should hold the distance.
    const delay = mateAfter - mateBefore;
    if (delay < 0 || (delay === 0 && mateAfter < 0)) return MoveClass.Best;
    return firstGradeMet(MATE_DELAYED, (limit) => delay < limit, MoveClass.Inaccuracy);
};

const gradeMateAppeared = (mateAfter: number): MoveClass => {
    if (mateAfter > 0) return MoveClass.Best;
    const movesUntilMated = -mateAfter;
    return firstGradeMet(MATE_ALLOWED, (limit) => movesUntilMated <= limit, MoveClass.Inaccuracy);
};

// Grades a move that isn't the engine's top choice by how much it gave away. Both scores are from
// the mover's side. Forced mates are judged by mate distance or the surviving eval instead of
// expected points, which can't tell "mate in 2" from "mate in 20".
export const gradeByLoss = (before: Score, after: Score): MoveClass => {
    if (before.kind === "mate" && after.kind === "mate") {
        return gradeMateToMate(before.mate, after.mate);
    }
    if (before.kind === "mate" && before.mate > 0 && after.kind === "cp") {
        return firstGradeMet(MATE_LOST, (limit) => after.cp >= limit, MoveClass.Blunder);
    }
    if (before.kind === "cp" && after.kind === "mate") {
        return gradeMateAppeared(after.mate);
    }

    // cp to cp, or escaping a forced mate against you.
    const loss = expectedPointsLost(before, after);
    return firstGradeMet(EXPECTED_POINTS_LOSS, (limit) => loss <= limit, MoveClass.Blunder);
};
