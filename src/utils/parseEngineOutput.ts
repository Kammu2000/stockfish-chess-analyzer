// utils
import { AppError } from "./errors/appError";

// types
import { AnalysisResult, Score } from "../types";

const last = <T>(items: T[]): T | undefined => items[items.length - 1];

// Last info line with a score for MultiPV slot `multipv` (the deepest one reached). Single-PV
// output has no "multipv" token, so slot 1 falls back to any scored info line.
const findInfoLine = (lines: string[], multipv: number): string | undefined => {
    const scored = lines.filter((line) => line.startsWith("info") && /\bscore /.test(line));
    const slot = new RegExp(`\\bmultipv ${multipv}\\b`);
    const matches = scored.filter((line) => slot.test(line));
    if (matches.length > 0) return last(matches);
    return multipv === 1 ? last(scored) : undefined;
};

const parseBestMove = (line: string | undefined): string | null => {
    if (!line) throw new AppError("EngineFailed", "Engine output has no bestmove line");

    const bestMove = line.split(/\s+/)[1];
    return !bestMove || bestMove === "(none)" ? null : bestMove;
};

const parseScore = (line: string): Score => {
    const mate = line.match(/\bscore mate (-?\d+)/);
    if (mate) return { kind: "mate", mate: parseInt(mate[1], 10) };

    const cp = line.match(/\bscore cp (-?\d+)/);
    if (cp) return { kind: "cp", cp: parseInt(cp[1], 10) };

    throw new AppError("EngineFailed", `Engine info line has no score: "${line}"`);
};

const parseInfoLine = (line: string): Pick<AnalysisResult, "score" | "depth" | "pv"> => {
    const depth = line.match(/\bdepth (\d+)/);
    if (!depth) throw new AppError("EngineFailed", `Engine info line has no depth: "${line}"`);
    const pv = line.match(/\bpv (.+)/);

    return {
        score: parseScore(line),
        depth: parseInt(depth[1], 10),
        pv: pv ? pv[1].trim().split(/\s+/) : [],
    };
};

// Parses the output of one "go" command. Throws if it lacks a scored info line or a bestmove line
export const parseEngineOutput = (raw: string): AnalysisResult => {
    const lines = raw.split("\n").filter(Boolean);

    const topLine = findInfoLine(lines, 1);
    if (!topLine) throw new AppError("EngineFailed", "Engine output has no scored info line");
    const secondLine = findInfoLine(lines, 2);

    return {
        bestMove: parseBestMove(lines.find((line) => line.startsWith("bestmove "))),
        ...parseInfoLine(topLine),
        ...(secondLine && { secondScore: parseScore(secondLine) }),
    };
};
