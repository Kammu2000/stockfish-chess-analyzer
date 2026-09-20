// utils
import { insertIfObj } from "./utils";

// constants
import { CP_CEILING } from "../constants/analysis";

// types
import { AnalysisResult } from "../types";

// Display-only stand-in for scoreCP on a forced mate (Stockfish's "score mate N" has no cp
// value). Move judgement branches on scoreMate directly and never reads this; see
// docs/move-classification.md.
const MATE_DISPLAY_CP = CP_CEILING * 30;

// Stockfish emits one info line per depth reached; the last "multipv 1" line is the deepest.
const findImportantInfoLine = (lines: string[]) => {
    const multipv1Lines = lines.filter(
        (line: string) => line.startsWith("info") && line.includes("multipv 1")
    );
    if (multipv1Lines.length > 0) return multipv1Lines[multipv1Lines.length - 1];

    const infoLines = lines.filter((line: string) => line.startsWith("info"));
    return infoLines[infoLines.length - 1];
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
            return mateM[1].startsWith("-") ? -MATE_DISPLAY_CP : MATE_DISPLAY_CP;
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
