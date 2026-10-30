// libs
import { Chess, Move, Square } from "chess.js";
import { describe, expect, it } from "vitest";

// utils
import { getUnsafePieces, isPieceSafe } from "./safety";
import { everyCaptureBackfires, isPieceTrapped } from "./threats";
import { GAMES, loadGame } from "../../test/famousGames";

// types
import { Color } from "../../types";

// Regression net: records the tactics verdicts after every move of real games. If a change is
// meant to alter these results, review the snapshot diff and update it with `npx vitest run -u`.

const describePieces = (board: Chess, color: Color, playedMove?: Move): string =>
    getUnsafePieces(board, color, playedMove)
        .map((piece) => {
            const flags = [
                isPieceTrapped(board, piece) ? "trapped" : "",
                everyCaptureBackfires(board, piece) ? "capture-backfires" : "",
            ].filter(Boolean);
            return `${piece.type}${piece.square}${flags.length ? `(${flags.join(",")})` : ""}`;
        })
        .join(" ") || "-";

describe.each(Object.entries(GAMES))("%s", (_name, pgn) => {
    const { history } = loadGame(pgn);

    it("judges piece safety the same way", { timeout: 30_000 }, () => {
        const lines = history.map((m) => {
            const before = new Chess(m.before);
            const after = new Chess(m.after);
            const mover = m.color as Color;
            const capturedSquare = (m.isEnPassant() ? m.to[0] + m.from[1] : m.to) as Square;
            const victim = m.captured
                ? isPieceSafe(before, {
                      type: m.captured,
                      color: mover === "w" ? "b" : "w",
                      square: capturedSquare,
                  })
                    ? " took-defended"
                    : " took-hanging"
                : "";
            return `${m.san}: unsafe after[${describePieces(after, mover, m)}]${victim}`;
        });
        expect(lines).toMatchSnapshot();
    });
});
