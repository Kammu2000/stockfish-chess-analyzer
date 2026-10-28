// libs
import { Chess, Move } from "chess.js";

// utils
import { povScore } from "./score";
import {
    getAttackingMoves,
    getCaptureSquare,
    getUnsafePieces,
    hasDangerLevels,
    isPieceSafe,
    isPieceTrapped,
} from "./tactics";
import { colorFromPly } from "./ply";
import { OpeningLookup } from "./opening";

// constants
import {
    CP_CEILING,
    WIN_CHANCE_COEFFICIENT,
    EXPECTED_POINTS_CP_GRADIENT,
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
    CRITICAL_RUNNER_UP_SAFE_CP,
    CRITICAL_THRESHOLD,
    ACC_SCALE,
    ACC_RATE,
    ACC_OFFSET,
    ACC_UNCERTAINTY_BONUS,
    ACC_WINDOW_MIN,
    ACC_WINDOW_MAX,
    ACC_WEIGHT_MIN,
    ACC_WEIGHT_MAX,
} from "../constants/analysis";

// types
import { MoveClass, ClassifiedMove, MoveNode, Score, Color, PositionEval } from "../types";

const winningChances = (score: Score): number => {
    const cp = score.kind === "mate" ? Math.sign(score.mate || 1) * CP_CEILING : score.cp;
    const ceiled = Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
    const chances = 2 / (1 + Math.exp(-WIN_CHANCE_COEFFICIENT * ceiled)) - 1;
    return Math.max(-1, Math.min(1, chances));
};

const winPercentage = (score: Score): number => 50 + 50 * winningChances(score);

// The mover's expected score (0 = loss, 1 = win) for an eval seen from their side. "Mate 0" only
// appears after the mover has just delivered mate, so it counts as a win.
const expectedPoints = (pov: Score): number => {
    if (pov.kind === "mate") return pov.mate < 0 ? 0 : 1;
    return 1 / (1 + Math.exp(-EXPECTED_POINTS_CP_GRADIENT * pov.cp));
};

const expectedPointsLost = (scoreBefore: Score, scoreAfter: Score, color: Color): number =>
    Math.max(
        0,
        expectedPoints(povScore(scoreBefore, color)) - expectedPoints(povScore(scoreAfter, color))
    );

const classifyByExpectedPointsLost = (loss: number): MoveClass => {
    if (loss <= 0) return MoveClass.Best;
    if (loss <= EXCELLENT_MAX_LOSS) return MoveClass.Excellent;
    if (loss <= GOOD_MAX_LOSS) return MoveClass.Good;
    if (loss <= INACCURACY_MAX_LOSS) return MoveClass.Inaccuracy;
    if (loss <= MISTAKE_MAX_LOSS) return MoveClass.Mistake;
    return MoveClass.Blunder;
};

// Grades a non-top move. Forced mates are judged by mate distance / surviving cp, not by the
// expected-points curve, which saturates and can't tell "mate in 2" from "mate in 20".
const classifyByPointLoss = (scoreBefore: Score, scoreAfter: Score, color: Color): MoveClass => {
    const before = povScore(scoreBefore, color);
    const after = povScore(scoreAfter, color);

    if (before.kind === "mate" && after.kind === "mate") {
        if (before.mate > 0 && after.mate < 0) {
            return after.mate < -MATE_FLIPPED_MISTAKE_MOVES ? MoveClass.Mistake : MoveClass.Blunder;
        }

        // The winner should bring mate one move closer; the defender should hold the distance.
        const mateLoss = after.mate - before.mate;
        if (mateLoss < 0 || (mateLoss === 0 && after.mate < 0)) return MoveClass.Best;
        if (mateLoss < MATE_DELAY_EXCELLENT_MOVES) return MoveClass.Excellent;
        if (mateLoss < MATE_DELAY_GOOD_MOVES) return MoveClass.Good;
        return MoveClass.Inaccuracy;
    }

    if (before.kind === "mate" && before.mate > 0 && after.kind === "cp") {
        if (after.cp >= MATE_LOST_EXCELLENT_CP) return MoveClass.Excellent;
        if (after.cp >= MATE_LOST_GOOD_CP) return MoveClass.Good;
        if (after.cp >= MATE_LOST_INACCURACY_CP) return MoveClass.Inaccuracy;
        if (after.cp >= MATE_LOST_MISTAKE_CP) return MoveClass.Mistake;
        return MoveClass.Blunder;
    }

    if (before.kind === "cp" && after.kind === "mate") {
        if (after.mate > 0) return MoveClass.Best;
        if (after.mate >= -MATE_ALLOWED_BLUNDER_MOVES) return MoveClass.Blunder;
        if (after.mate >= -MATE_ALLOWED_MISTAKE_MOVES) return MoveClass.Mistake;
        return MoveClass.Inaccuracy;
    }

    return classifyByExpectedPointsLost(expectedPointsLost(scoreBefore, scoreAfter, color));
};

const isLosingFor = (pov: Score): boolean => (pov.kind === "cp" ? pov.cp : pov.mate) < 0;

// Candidate for "critical"/"brilliant" status: a move that actually required thought — not
// forced by check, not already a foregone conclusion, not losing, not a queen promotion.
const isCriticalCandidate = (
    playedMove: Move,
    scoreAfter: Score,
    runnerUpScoreBefore: Score | undefined,
    boardBefore: Chess
): boolean => {
    const color = playedMove.color as Color;
    const povAfter = povScore(scoreAfter, color);

    // Still comfortably winning even without finding this exact move.
    const reference = runnerUpScoreBefore ? povScore(runnerUpScoreBefore, color) : povAfter;
    if (reference.kind === "cp" && reference.cp >= CRITICAL_RUNNER_UP_SAFE_CP) return false;

    if (isLosingFor(povAfter)) return false;
    if (playedMove.promotion === "q") return false;
    if (boardBefore.isCheck()) return false;

    return true;
};

// The runner-up line was significantly worse — genuinely hard to find, not just "the best move."
const isCritical = (
    playedMove: Move,
    boardBefore: Chess,
    scoreBefore: Score,
    scoreAfter: Score,
    runnerUpScoreBefore: Score | undefined
): boolean => {
    const color = playedMove.color as Color;

    // Finding a mate you already have isn't critical.
    const povAfter = povScore(scoreAfter, color);
    if (povAfter.kind === "mate" && povAfter.mate > 0) return false;

    // Grabbing already-hanging material is just the obvious move.
    if (playedMove.captured) {
        const capturedPiece = {
            type: playedMove.captured,
            color: color === "w" ? ("b" as Color) : ("w" as Color),
            square: getCaptureSquare(playedMove),
        };
        if (!isPieceSafe(boardBefore, capturedPiece)) return false;
    }

    if (!runnerUpScoreBefore) return false;
    return expectedPointsLost(scoreBefore, runnerUpScoreBefore, color) >= CRITICAL_THRESHOLD;
};

// A real sacrifice: leaves a piece genuinely hanging, not a retreat to safety, not a trade, not a
// piece that was doomed anyway, and not a "sacrifice" the opponent can't afford to accept.
const isBrilliant = (playedMove: Move, boardBefore: Chess, boardAfter: Chess): boolean => {
    if (playedMove.promotion) return false;

    const color = playedMove.color as Color;
    const previousUnsafe = getUnsafePieces(boardBefore, color);
    const unsafe = getUnsafePieces(boardAfter, color, playedMove);

    // Moving to safety without giving check can't be a sacrifice.
    if (!boardAfter.isCheck() && unsafe.length < previousUnsafe.length) return false;

    // Every capture of the "sacrificed" piece leaves the capturer facing an equal or bigger loss.
    const capturesAreTraps = unsafe.every((piece) =>
        hasDangerLevels(boardAfter, piece, getAttackingMoves(boardAfter, piece, false))
    );
    if (capturesAreTraps) return false;

    const previousTrapped = previousUnsafe.filter((piece) => isPieceTrapped(boardBefore, piece));
    const trapped = unsafe.filter((piece) => isPieceTrapped(boardAfter, piece));
    const movedPieceWasTrapped = previousTrapped.some((piece) => piece.square === playedMove.from);

    // No real risk if every unsafe piece was doomed anyway, or trapped pieces didn't increase.
    if (
        trapped.length === unsafe.length ||
        movedPieceWasTrapped ||
        trapped.length < previousTrapped.length
    ) {
        return false;
    }

    return unsafe.length > 0;
};

export const buildClassifiedMoves = (
    moves: MoveNode[],
    posEvals: PositionEval[],
    lookupOpening?: OpeningLookup
): ClassifiedMove[] => {
    return moves.map((move, i) => {
        const scoreBefore = posEvals[i].score;
        const scoreAfter = posEvals[i + 1].score;
        const bestMove = posEvals[i].bestMove;
        const runnerUpScoreBefore = posEvals[i].secondScore;

        const isBestMove = bestMove !== null && move.uci === bestMove;
        const boardBefore = new Chess(move.fenBefore);
        const boardAfter = new Chess(move.fen);

        const opening = lookupOpening?.(move.fen);

        let classification: MoveClass;

        // Forced wins over Theory, so a forced recapture inside a book line still shows Forced.
        if (boardBefore.moves().length <= 1) {
            classification = MoveClass.Forced;
        } else if (opening) {
            classification = MoveClass.Theory;
        } else if (boardAfter.isCheckmate()) {
            // Stockfish's "mate 0" is a terminal sentinel, not a real mate-in-N value, so detect
            // the win directly from the position instead.
            classification = MoveClass.Best;
        } else {
            const playedMove = new Chess(move.fenBefore).move(move.san);

            classification = isBestMove
                ? MoveClass.Best
                : classifyByPointLoss(scoreBefore, scoreAfter, playedMove.color as Color);

            const candidate = isCriticalCandidate(
                playedMove,
                scoreAfter,
                runnerUpScoreBefore,
                boardBefore
            );

            if (
                isBestMove &&
                candidate &&
                isCritical(playedMove, boardBefore, scoreBefore, scoreAfter, runnerUpScoreBefore)
            ) {
                classification = MoveClass.Critical;
            }

            const isBestTier =
                classification === MoveClass.Best || classification === MoveClass.Critical;

            if (isBestTier && candidate && isBrilliant(playedMove, boardBefore, boardAfter)) {
                classification = MoveClass.Brilliant;
            }
        }

        return {
            ...move,
            scoreBefore,
            scoreAfter,
            bestMove,
            classification,
            pvAfter: posEvals[i + 1].pv ?? [],
            opening,
        };
    });
};

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

// White's win % for a position. "Mate 0" means the side to move is already mated, so it is decided
// by who just moved rather than by the score's (meaningless) sign.
const whiteWinPercent = (score: Score, lastMover: Color | null): number =>
    score.kind === "mate" && score.mate === 0 && lastMover
        ? lastMover === "w"
            ? 100
            : 0
        : winPercentage(score);

const moveAccuracy = (winBefore: number, winAfter: number): number => {
    if (winAfter >= winBefore) return 100;
    const raw = ACC_SCALE * Math.exp(-ACC_RATE * (winBefore - winAfter)) - ACC_OFFSET;
    return clamp(raw + ACC_UNCERTAINTY_BONUS, 0, 100);
};

const standardDeviation = (values: number[]): number => {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
};

// Port of Lichess's AccuracyPercent.gameAccuracy: the average of a volatility-weighted mean
// (mistakes in sharp positions count more) and a harmonic mean (a few bad moves drag it down).
export const computeAccuracy = (classifiedMoves: ClassifiedMove[], color: Color): number => {
    if (!classifiedMoves.some((m) => colorFromPly(m.ply) === color)) return 100;

    const winPercents = [
        whiteWinPercent(classifiedMoves[0].scoreBefore, null),
        ...classifiedMoves.map((m) => whiteWinPercent(m.scoreAfter, colorFromPly(m.ply))),
    ];

    // One window per move: the first few moves reuse the opening window so every move has one.
    const windowSize = clamp(
        Math.floor((winPercents.length - 1) / 10),
        ACC_WINDOW_MIN,
        ACC_WINDOW_MAX
    );
    const firstWindow = winPercents.slice(0, windowSize);
    const windows = [
        ...Array.from({ length: Math.min(windowSize, winPercents.length) - 2 }, () => firstWindow),
        ...Array.from({ length: Math.max(1, winPercents.length - windowSize + 1) }, (_, i) =>
            winPercents.slice(i, i + windowSize)
        ),
    ];

    const scored = classifiedMoves
        .map((m, i) => {
            const before = winPercents[i];
            const after = winPercents[i + 1];
            const accuracy =
                colorFromPly(m.ply) === "w"
                    ? moveAccuracy(before, after)
                    : moveAccuracy(100 - before, 100 - after);
            const weight = clamp(standardDeviation(windows[i]), ACC_WEIGHT_MIN, ACC_WEIGHT_MAX);
            return { color: colorFromPly(m.ply), accuracy, weight };
        })
        .filter((s) => s.color === color);

    const weightedMean =
        scored.reduce((sum, s) => sum + s.accuracy * s.weight, 0) /
        scored.reduce((sum, s) => sum + s.weight, 0);
    const harmonicMean = scored.length / scored.reduce((sum, s) => sum + 1 / s.accuracy, 0);

    const acc = (weightedMean + harmonicMean) / 2;
    return Math.max(0, Math.min(100, Math.round(acc * 10) / 10));
};
