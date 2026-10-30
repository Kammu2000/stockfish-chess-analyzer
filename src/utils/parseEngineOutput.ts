// types
import { AnalysisResult, Score } from "../types";

// Last info line with a score for MultiPV slot `multipv` (the deepest one reached). Single-PV
// output has no "multipv" token, so slot 1 falls back to any scored info line.
const last = <T>(items: T[]): T | undefined => items[items.length - 1];

const findInfoLine = (lines: string[], multipv: number): string | undefined => {
    const scored = lines.filter((line) => line.startsWith("info") && /\bscore /.test(line));
    const slot = new RegExp(`\\bmultipv ${multipv}\\b`);
    const matches = scored.filter((line) => slot.test(line));
    if (matches.length > 0) return last(matches);
    return multipv === 1 ? last(scored) : undefined;
};

const parseBestMove = (line: string | undefined): Pick<AnalysisResult, "bestMove" | "ponder"> => {
    if (!line) throw new Error("Engine output has no bestmove line");

    const parts = line.split(/\s+/);
    const bestMove = parts[1];
    const ponderIdx = parts.indexOf("ponder");

    return {
        bestMove: !bestMove || bestMove === "(none)" ? null : bestMove,
        ...(ponderIdx !== -1 && { ponder: parts[ponderIdx + 1] }),
    };
};

const parseScore = (line: string): Score => {
    const mate = line.match(/\bscore mate (-?\d+)/);
    if (mate) return { kind: "mate", mate: parseInt(mate[1], 10) };

    const cp = line.match(/\bscore cp (-?\d+)/);
    if (cp) return { kind: "cp", cp: parseInt(cp[1], 10) };

    throw new Error(`Engine info line has no score: "${line}"`);
};

const parseInfoLine = (line: string): Pick<AnalysisResult, "score" | "depth" | "pv"> => {
    const depth = line.match(/\bdepth (\d+)/);
    if (!depth) throw new Error(`Engine info line has no depth: "${line}"`);
    const pv = line.match(/\bpv (.+)/);

    return {
        score: parseScore(line),
        depth: parseInt(depth[1], 10),
        pv: pv ? pv[1].trim().split(/\s+/) : [],
    };
};

// Parses the output of one "go" command. Throws if it lacks a scored info line or a bestmove
// line, rather than inventing a 0.00 evaluation for a broken engine reply.
export const parseEngineOutput = (raw: string): AnalysisResult => {
    const lines = raw.split("\n").filter(Boolean);

    const topLine = findInfoLine(lines, 1);
    if (!topLine) throw new Error("Engine output has no scored info line");
    const secondLine = findInfoLine(lines, 2);

    return {
        ...parseBestMove(lines.find((line) => line.startsWith("bestmove "))),
        ...parseInfoLine(topLine),
        ...(secondLine && { secondScore: parseScore(secondLine) }),
    };
};
