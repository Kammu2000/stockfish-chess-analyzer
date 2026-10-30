export type ImportSource = "chesscom" | "lichess";

export type GameResult = "1-0" | "0-1" | "1/2-1/2";

export interface ImportedGame {
    pgn: string;
    white: string;
    black: string;
    result: GameResult;
    timeControl: string; // as the site names it, e.g. "blitz"
    isoDate: string;
}
