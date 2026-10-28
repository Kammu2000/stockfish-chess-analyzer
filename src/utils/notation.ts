// libs
import { Chess } from "chess.js";

// Engine moves are UCI ("g1f3", "e7e8q"); these convert them to SAN ("Nf3", "e8=Q+") for display.

const playUci = (board: Chess, uci: string): string | null => {
    try {
        return board.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
        }).san;
    } catch {
        return null;
    }
};

// SAN of a single UCI move from `fen`, or null if it isn't legal there.
export const uciToSan = (fen: string, uci: string): string | null => playUci(new Chess(fen), uci);

// A UCI line from `fen` as numbered SAN, e.g. "12... Nc6 13. Bb5 a6". Stops at the first illegal
// move (shouldn't happen for engine output, but the line is display-only so never throw).
export const formatUciLine = (fen: string, ucis: string[], maxPlies = ucis.length): string => {
    const board = new Chess(fen);
    const parts: string[] = [];

    for (const [i, uci] of ucis.slice(0, maxPlies).entries()) {
        const moveNumber = board.moveNumber();
        const isWhite = board.turn() === "w";
        const san = playUci(board, uci);
        if (!san) break;

        if (isWhite) parts.push(`${moveNumber}. ${san}`);
        else parts.push(i === 0 ? `${moveNumber}... ${san}` : san);
    }

    return parts.join(" ");
};

const pieceCounts = (fen: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const ch of fen.split(" ")[0]) if (/[a-zA-Z]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
    return counts;
};

// True if going from `a` to `b` (either direction) promotes or un-promotes a pawn: for one side,
// the pawn count and some other piece count change in opposite directions. Captures only ever
// remove pieces of one side, so they don't match.
export const involvesPromotion = (a: string, b: string): boolean => {
    const ca = pieceCounts(a);
    const cb = pieceCounts(b);
    const diff = (piece: string) => (cb[piece] ?? 0) - (ca[piece] ?? 0);

    return ["PNBRQ", "pnbrq"].some(([pawn, ...pieces]) => {
        const pawnDiff = diff(pawn);
        return (
            pawnDiff !== 0 &&
            pieces.some((piece) => Math.sign(diff(piece)) === -Math.sign(pawnDiff))
        );
    });
};
