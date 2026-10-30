// libs
import { describe, expect, it } from "vitest";

// utils
import { parsePGN } from "./pgnParser";

// constants
import { START_FEN } from "../constants/board";

describe("parsePGN", () => {
    it("parses headers and moves with chained FENs, despite a BOM and CRLF line endings", () => {
        const pgn = '\uFEFF[White "Alice"]\r\n[Black "Bob"]\r\n\r\n1. e4 e5 2. Nf3 Nc6 *';
        const { headers, moves } = parsePGN(pgn);

        expect(headers).toMatchObject({ White: "Alice", Black: "Bob" });
        expect(moves.map((m) => [m.ply, m.san, m.uci])).toEqual([
            [0, "e4", "e2e4"],
            [1, "e5", "e7e5"],
            [2, "Nf3", "g1f3"],
            [3, "Nc6", "b8c6"],
        ]);
        expect(moves[0].fenBefore).toBe(START_FEN);
        moves.slice(1).forEach((m, i) => expect(m.fenBefore).toBe(moves[i].fenAfter));
    });

    it("includes the promotion piece in UCI", () => {
        const pgn = "1. b4 a5 2. bxa5 b6 3. axb6 Bb7 4. bxc7 Nc6 5. cxd8=Q+ *";
        const { moves } = parsePGN(pgn);
        expect(moves[moves.length - 1].uci).toBe("c7d8q");
    });

    it("throws on an illegal move", () => {
        expect(() => parsePGN("1. e4 e4 *")).toThrow();
    });

    it("starts from the [FEN] header position", () => {
        const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        const { moves } = parsePGN(`[SetUp "1"]\n[FEN "${fen}"]\n\n1... e5 2. Nf3 *`);
        expect(moves.map((m) => m.uci)).toEqual(["e7e5", "g1f3"]);
        expect(moves[0].fenBefore).toBe(fen);
    });
});
