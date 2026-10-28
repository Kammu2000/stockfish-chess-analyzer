export type Color = "w" | "b";

export interface ParsedGame {
    headers: Record<string, string>;
    moves: MoveNode[];
}

export interface MoveNode {
    san: string;
    uci: string;
    fen: string; // FEN after playing move
    ply: number; // 0-indexed half-move (0 = after White's first move)
    fenBefore: string; // FEN before playing move
}

// Always White-absolute, never side-to-move-relative.
export type Score = { kind: "cp"; cp: number } | { kind: "mate"; mate: number };

export interface AnalysisResult {
    bestMove: string | null; // UCI, e.g. "e2e4"; null if no legal move
    score: Score;
    secondScore?: Score; // MultiPV 2 runner-up line, when found
    depth: number;
    pv: string[];
    ponder?: string; // move engine expects opponent to play after best move
}

// One evaluated position (N+1 of these cover N moves: posEvals[i] is "before" move i,
// posEvals[i + 1] is "after" move i, since fenAfter[i] === fenBefore[i + 1]).
export interface PositionEval {
    score: Score;
    secondScore?: Score;
    bestMove: string | null;
    pv: string[];
}

export enum MoveClass {
    Brilliant = "brilliant",
    Critical = "critical",
    Best = "best",
    Excellent = "excellent",
    Good = "good",
    Forced = "forced",
    Theory = "theory",
    Inaccuracy = "inaccuracy",
    Mistake = "mistake",
    Blunder = "blunder",
}

// A named opening position (ECO code + name), from the opening book.
export interface Opening {
    eco: string;
    name: string;
}

export interface ClassifiedMove extends MoveNode {
    scoreBefore: Score;
    scoreAfter: Score;
    bestMove: string | null; // engine's top choice from fenBefore
    classification: MoveClass;
    pvAfter: string[]; // engine's continuation (UCI moves) after the played move
    opening?: Opening; // opening reached by this move, if the position is in the book
}

export enum AnalysisStatus {
    Idle = "idle",
    Analyzing = "analyzing",
    Done = "done",
    Error = "error",
}

export type AnalysisPhase =
    | { status: AnalysisStatus.Idle }
    | { status: AnalysisStatus.Analyzing; progress: number }
    | {
          status: AnalysisStatus.Done;
          results: ClassifiedMove[];
          whiteAccuracy: number;
          blackAccuracy: number;
      }
    | { status: AnalysisStatus.Error; error: string };
