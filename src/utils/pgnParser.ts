// libs
import { Chess } from "chess.js";

// utils
import { toUci } from "./notation";

// types
import { ParsedGame } from "../types";

const stripBomAndCrlf = (text: string): string =>
    text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

export function parsePGN(pgn: string): ParsedGame {
    const chess = new Chess();

    chess.loadPgn(stripBomAndCrlf(pgn));

    const moves = chess.history({ verbose: true }).map((move, ply) => ({
        san: move.san,
        uci: toUci(move),
        fenAfter: move.after,
        fenBefore: move.before,
        ply,
    }));

    return { headers: { ...chess.getHeaders() }, moves };
}
