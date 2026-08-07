// utils
import { insertIfObj } from "./utils";

// types
import { AnalysisResult } from "../types";

const findImportantInfoLine = (lines: string[]) => {
    const importantInfoLine =
        lines.find((line: string) => line.startsWith("info") && line.includes("multipv 1")) ??
        lines.find((line: string) => line.startsWith("info"));
    return importantInfoLine;
};

const parseBestMove = (line: string): { bestMove: string; ponder?: string } => {
    if (!line) {
        return { bestMove: "(none)" };
    }

    const parts = line.split(/\s+/);
    const ponderIdx = parts.indexOf("ponder");

    return {
        bestMove: parts[1] ?? "(none)",
        ...insertIfObj(ponderIdx !== -1, { ponder: parts[ponderIdx + 1] }),
    };
};

const parseImportantInfo = (line: string) => {
    if (!line) {
        return { scoreCP: 0, scoreMate: undefined, depth: 0, pv: [] };
    }

    const depthM = line.match(/\bdepth (\d+)/);
    const cpM = line.match(/\bscore cp (-?\d+)/);
    const mateM = line.match(/\bscore mate (-?\d+)/);
    const pvM = line.match(/\bpv (.+)/);

    const computeScoreCP = () => {
        if (mateM) {
            // 30k signifies infinite advantage
            return mateM[1].startsWith("-") ? -30000 : 30000;
        }

        return cpM ? parseInt(cpM[1], 10) : 0;
    };

    const depth = depthM ? parseInt(depthM[1], 10) : 0;
    const scoreMate = mateM ? parseInt(mateM[1], 10) : undefined;
    const pv = pvM ? pvM[1].trim().split(/\s+/) : [];

    return { scoreCP: computeScoreCP(), scoreMate, depth, pv };
};

export const parseEngineOutput = (raw: string): AnalysisResult => {
    const lines = raw.split("\n").filter(Boolean);

    const importantInfoLine = findImportantInfoLine(lines) ?? "";
    const bestMoveLine = lines.find((line: string) => line.startsWith("bestmove ")) ?? "";

    return { ...parseBestMove(bestMoveLine), ...parseImportantInfo(importantInfoLine) };
};
