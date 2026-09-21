// core chess types
export type Color = "w" | "b";

export interface ParsedGame {
    headers: Record<string, string>;
    moves: MoveNode[];
}

export interface MoveNode {
    san: string; // "Nf3"
    uci: string; // "g1f3"
    fen: string; // FEN after the move
    fenBefore: string; // FEN before the move
    moveNumber: number; // 1-based full move counter
    color: Color;
    ply: number; // 0-indexed half-move (0 = after White's first move)
}

// engine / analysis types

// White-absolute (+ = good for White). Mate is a distinct kind, not a cp magnitude — see docs/move-classification.md.
export type Score = { kind: "cp"; cp: number } | { kind: "mate"; mate: number };

export interface AnalysisResult {
    bestMove: string | null; // UCI, e.g. "e2e4"; null if no legal move
    score: Score;
    secondScore?: Score; // MultiPV 2 runner-up line, when found
    depth: number;
    pv: string[]; // principal variation (UCI move list)
    ponder?: string; // move engine expects opponent to play after best move
}

export enum MoveClass {
    Brilliant = "brilliant",
    Critical = "critical",
    Best = "best",
    Excellent = "excellent",
    Good = "good",
    Forced = "forced",
    Inaccuracy = "inaccuracy",
    Mistake = "mistake",
    Blunder = "blunder",
}

export interface ClassifiedMove extends MoveNode {
    scoreBefore: Score;
    scoreAfter: Score;
    bestMove: string | null; // engine's top choice from fenBefore
    bestScoreBefore: Score; // score if the engine's best move had been played
    classification: MoveClass;
    pvAfter: string[]; // engine's continuation (UCI moves) after the played move
}

// Each status carries only the data valid for it, so e.g. "done" is never observed without results.
export type AnalysisPhase =
    | { status: "idle" }
    | { status: "analyzing"; progress: number }
    | { status: "done"; results: ClassifiedMove[]; whiteAccuracy: number; blackAccuracy: number }
    | { status: "error"; error: string };
