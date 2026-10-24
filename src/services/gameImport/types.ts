export type ImportSource = "chesscom" | "lichess";

export interface ImportedGame {
    pgn: string;
    white: string;
    black: string;
    result: string; // e.g. "1-0", "0-1", "1/2-1/2"
    timeControl: string; // e.g. "blitz", "rapid", "bullet"
    date: string; // ISO string
}

export class GameImportError extends Error {
    constructor(
        message: string,
        public readonly notFound: boolean = false
    ) {
        super(message);
        this.name = "GameImportError";
    }
}
