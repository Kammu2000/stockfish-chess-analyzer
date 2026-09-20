// core chess types
export type Color = "w" | "b";

export interface ParsedGame {
    headers: Record<string, string>;
    moves: MoveNode[];
}

export interface MoveNode {
    san: string; // Standard Algebraic Notation  "Nf3"
    uci: string; // Long algebraic UCI format "g1f3"
    fen: string; // FEN after the move
    fenBefore: string; // FEN before the move
    moveNumber: number; // 1-based full move counter
    color: Color;
    ply: number; // 0-indexed half-move (0 = after White's first move)
}

// engine / analysis types

// A Stockfish evaluation, always White-absolute (+ = good for White). A mate is a distinct kind,
// never a centipawn magnitude standing in for "infinity" — see docs/move-classification.md.
export type Score = { kind: "cp"; cp: number } | { kind: "mate"; mate: number };

export interface AnalysisResult {
    bestMove: string | null; // UCI notation "e2e4"; null when there is no legal move
    score: Score;
    depth: number;
    pv: string[]; // principal variation (UCI move list)
    ponder?: string; // move engine expects opponent to play after best move
}

export enum MoveClass {
    Best = "best",
    Excellent = "excellent",
    Good = "good",
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
    pvAfter: string[]; // engine's continuation (sequence of moves in uci format) from the played move
}

// analysis store state types: each status carries exactly the data that's valid for it, so a
// component can never observe e.g. "done" with no results, or an accuracy while still analyzing.
export type AnalysisPhase =
    | { status: "idle" }
    | { status: "analyzing"; progress: number }
    | { status: "done"; results: ClassifiedMove[]; whiteAccuracy: number; blackAccuracy: number }
    | { status: "error"; error: string };
