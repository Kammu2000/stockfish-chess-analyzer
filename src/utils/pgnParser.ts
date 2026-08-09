// libs
import { Chess } from "chess.js";

// types
import { ParsedGame, MoveNode } from "../types";

export function parsePGN(pgn: string): ParsedGame {
    const chess = new Chess();

    // rationale: strip BOM if pgn starts with it and normalise windows line endings before handing to chess.js
    chess.loadPgn(pgn.replace(/^﻿/, "").replace(/\r\n/g, "\n"));

    const headers: Record<string, string> = {};

    for (const [k, v] of Object.entries(chess.getHeaders())) {
        headers[k] = v as string;
    }

    const history = chess.history({ verbose: true });
    const moves: MoveNode[] = [];

    // replay from the start to capture FEN at each ply
    const replay = new Chess();
    let ply = 0;

    for (const move of history) {
        const fenBefore = replay.fen();
        replay.move(move.san);
        const fenAfter = replay.fen();

        moves.push({
            san: move.san,
            uci: move.from + move.to + (move.promotion ?? ""),
            fen: fenAfter,
            fenBefore: fenBefore,
            moveNumber: Math.floor(ply / 2) + 1,
            color: move.color,
            ply,
        });

        ply++;
    }

    return { headers, moves };
}
