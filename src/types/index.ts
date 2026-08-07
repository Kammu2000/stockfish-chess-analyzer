// core chess types
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
    color: "w" | "b"; // white or black
    ply: number; // 0-indexed half-move (0 = after White's first move)
}

// engine / analysis types
export interface AnalysisResult {
    bestMove: string; // UCI notation "e2e4"
    scoreCP: number; // centipawns from White's POV (+100 = +1 pawn for White)
    depth: number;
    pv: string[]; // principal variation (UCI move list)
    ponder?: string; // move engine expects opponent to play after best move
    scoreMate?: number; // mate in N (positive = White mates, negative = Black mates)
}

export enum MoveClass {
    Brilliant = "brilliant",
    Best = "best",
    Excellent = "excellent",
    Good = "good",
    Inaccuracy = "inaccuracy",
    Mistake = "mistake",
    Blunder = "blunder",
}

export interface ClassifiedMove extends MoveNode {
    evalBefore: number; // centipawns (White POV) before the move
    evalAfter: number; // centipawns (White POV) after the move
    bestMove: string; // engine's top choice from fenBefore
    bestEvalBefore: number; // eval if best move had been played
    delta: number; // how much worse than best (always >= 0)
    classification: MoveClass;
    pvAfter: string[]; // engine's continuation (sequence of moves in uci format) from the played move
    scoreMate?: number; // mate in N if applicable (positive = White mates)
}

// analysis store state types
export type AnalysisStatus = "idle" | "analyzing" | "done" | "error";
