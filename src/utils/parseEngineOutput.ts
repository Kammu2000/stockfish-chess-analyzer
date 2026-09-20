// utils
import { insertIfObj } from "./utils";

// types
import { AnalysisResult, Score } from "../types";

// Stockfish emits one info line per depth reached; the last "multipv 1" line is the deepest.
const findImportantInfoLine = (lines: string[]) => {
    const multipv1Lines = lines.filter(
        (line: string) => line.startsWith("info") && line.includes("multipv 1")
    );
    if (multipv1Lines.length > 0) return multipv1Lines[multipv1Lines.length - 1];

    const infoLines = lines.filter((line: string) => line.startsWith("info"));
    return infoLines[infoLines.length - 1];
};

const parseBestMove = (line: string): { bestMove: string | null; ponder?: string } => {
    if (!line) return { bestMove: null };

    const parts = line.split(/\s+/);
    const ponderIdx = parts.indexOf("ponder");
    const bestMove = parts[1];

    return {
        bestMove: !bestMove || bestMove === "(none)" ? null : bestMove,
        ...insertIfObj(ponderIdx !== -1, { ponder: parts[ponderIdx + 1] }),
    };
};

const parseImportantInfo = (line: string): { score: Score; depth: number; pv: string[] } => {
    if (!line) return { score: { kind: "cp", cp: 0 }, depth: 0, pv: [] };

    const depthM = line.match(/\bdepth (\d+)/);
    const cpM = line.match(/\bscore cp (-?\d+)/);
    const mateM = line.match(/\bscore mate (-?\d+)/);
    const pvM = line.match(/\bpv (.+)/);

    const score: Score = mateM
        ? { kind: "mate", mate: parseInt(mateM[1], 10) }
        : { kind: "cp", cp: cpM ? parseInt(cpM[1], 10) : 0 };

    return {
        score,
        depth: depthM ? parseInt(depthM[1], 10) : 0,
        pv: pvM ? pvM[1].trim().split(/\s+/) : [],
    };
};

export const parseEngineOutput = (raw: string): AnalysisResult => {
    const lines = raw.split("\n").filter(Boolean);

    const importantInfoLine = findImportantInfoLine(lines) ?? "";
    const bestMoveLine = lines.find((line: string) => line.startsWith("bestmove ")) ?? "";

    return { ...parseBestMove(bestMoveLine), ...parseImportantInfo(importantInfoLine) };
};
