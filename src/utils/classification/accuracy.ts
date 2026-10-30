// utils
import { winPercent } from "./winProbability";
import { colorFromPly } from "../ply";
import { clamp } from "../utils";

// constants
import {
    ACC_SCALE,
    ACC_RATE,
    ACC_OFFSET,
    ACC_UNCERTAINTY_BONUS,
    ACC_WINDOW_MIN,
    ACC_WINDOW_MAX,
    ACC_WEIGHT_MIN,
    ACC_WEIGHT_MAX,
} from "../../constants/analysis";

// types
import { ClassifiedMove, Color, Score } from "../../types";

const sum = (values: number[]): number => values.reduce((total, v) => total + v, 0);

const standardDeviation = (values: number[]): number => {
    const mean = sum(values) / values.length;
    return Math.sqrt(sum(values.map((v) => (v - mean) ** 2)) / values.length);
};

// White's win % after `mover` played. "Mate 0" means the side to move has been mated, so the
// winner is whoever just moved, whatever the score's sign.
const whiteWinPercentAfter = (score: Score, mover: Color): number => {
    if (score.kind === "mate" && score.mate === 0) return mover === "w" ? 100 : 0;
    return winPercent(score);
};

const moverWinPercent = (whiteWinPercent: number, mover: Color): number =>
    mover === "w" ? whiteWinPercent : 100 - whiteWinPercent;

// Lichess's per-move accuracy from the mover's win % before and after the move.
const moveAccuracy = (winBefore: number, winAfter: number): number => {
    if (winAfter >= winBefore) return 100;
    const raw = ACC_SCALE * Math.exp(-ACC_RATE * (winBefore - winAfter)) - ACC_OFFSET;
    return clamp(raw + ACC_UNCERTAINTY_BONUS, 0, 100);
};

// One window of win % values per move, to measure how sharp the game was around it. The first
// window is repeated so the opening moves get one too (as Lichess does).
const volatilityWindows = (winPercents: number[]): number[][] => {
    const size = clamp(Math.floor((winPercents.length - 1) / 10), ACC_WINDOW_MIN, ACC_WINDOW_MAX);
    const paddingCount = Math.max(0, Math.min(size, winPercents.length) - 2);
    const slidingCount = Math.max(1, winPercents.length - size + 1);

    const firstWindow = winPercents.slice(0, size);
    return [
        ...Array.from({ length: paddingCount }, () => firstWindow),
        ...Array.from({ length: slidingCount }, (_, i) => winPercents.slice(i, i + size)),
    ];
};

// Port of Lichess's AccuracyPercent.gameAccuracy: the average of a volatility-weighted mean
// (mistakes in sharp positions count more) and a harmonic mean (a few bad moves drag it down).
export const computeAccuracy = (moves: ClassifiedMove[], color: Color): number => {
    if (!moves.some((m) => colorFromPly(m.ply) === color)) return 100;

    const winPercents = [
        winPercent(moves[0].scoreBefore),
        ...moves.map((m) => whiteWinPercentAfter(m.scoreAfter, colorFromPly(m.ply))),
    ];
    const windows = volatilityWindows(winPercents);

    const scored = moves
        .map((m, i) => ({
            mover: colorFromPly(m.ply),
            winBefore: moverWinPercent(winPercents[i], color),
            winAfter: moverWinPercent(winPercents[i + 1], color),
            window: windows[i],
        }))
        .filter((move) => move.mover === color)
        .map((move) => ({
            accuracy: moveAccuracy(move.winBefore, move.winAfter),
            weight: clamp(standardDeviation(move.window), ACC_WEIGHT_MIN, ACC_WEIGHT_MAX),
        }));

    const weightedMean =
        sum(scored.map((s) => s.accuracy * s.weight)) / sum(scored.map((s) => s.weight));
    const harmonicMean = scored.length / sum(scored.map((s) => 1 / s.accuracy));

    return clamp(Math.round(((weightedMean + harmonicMean) / 2) * 10) / 10, 0, 100);
};
