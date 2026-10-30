export type Color = "w" | "b";

export interface ParsedGame {
    headers: Record<string, string>;
    moves: MoveNode[];
}

export interface MoveNode {
    san: string;
    uci: string;
    fenBefore: string;
    fenAfter: string;
    ply: number; // 0-indexed half-move (0 = White's first move)
}

// Always White-absolute, never side-to-move-relative.
export type Score = { kind: "cp"; cp: number } | { kind: "mate"; mate: number };

export interface PositionEval {
    score: Score;
    secondScore?: Score; // MultiPV 2 runner-up line, when found
    bestMove: string | null; // UCI, e.g. "e2e4"; null if no legal move
    pv: string[];
}

export interface AnalysisResult extends PositionEval {
    depth: number;
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

// A position in the game tree: on the main line (ply -1 = start) or at a user variation node.
export type PositionRef = { kind: "main"; ply: number } | { kind: "var"; id: string };

export type VariationStatus = "pending" | "done" | "error";

// A user-played move off the main line (or off another variation). children[0] continues this
// line; children[1..] are alternatives to children[0] (sub-variations).
export interface VariationNode {
    id: string;
    parent: PositionRef;
    move: MoveNode; // ply is the absolute half-move index, as on the main line
    children: string[];
    status: VariationStatus;
    evalAfter?: PositionEval;
    result?: ClassifiedMove;
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
          positionEvals: PositionEval[];
          whiteAccuracy: number;
          blackAccuracy: number;
      }
    | { status: AnalysisStatus.Error; error: string };
