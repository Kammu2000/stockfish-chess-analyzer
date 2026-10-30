// libs
import { describe, expect, it } from "vitest";

// utils
import { parseEngineOutput } from "./parseEngineOutput";

describe("parseEngineOutput", () => {
    it("takes the deepest line of each MultiPV slot", () => {
        const raw = [
            "info depth 10 multipv 1 score cp 20 pv e2e4 e7e5",
            "info depth 10 multipv 2 score cp 5 pv d2d4",
            "info depth 12 multipv 1 score cp 35 pv e2e4 c7c5 g1f3",
            "info depth 12 multipv 2 score cp -10 pv d2d4 d7d5",
            "bestmove e2e4 ponder c7c5",
        ].join("\n");

        expect(parseEngineOutput(raw)).toEqual({
            bestMove: "e2e4",
            ponder: "c7c5",
            score: { kind: "cp", cp: 35 },
            secondScore: { kind: "cp", cp: -10 },
            depth: 12,
            pv: ["e2e4", "c7c5", "g1f3"],
        });
    });

    it("parses mate scores and falls back to non-MultiPV info lines", () => {
        const raw = "info depth 5 score mate -3 pv h7h6\nbestmove h7h6";
        const result = parseEngineOutput(raw);
        expect(result.score).toEqual({ kind: "mate", mate: -3 });
        expect(result.secondScore).toBeUndefined();
        expect(result.ponder).toBeUndefined();
    });

    it("reports no best move when the side to move has none", () => {
        const result = parseEngineOutput("info depth 0 score mate 0\nbestmove (none)");
        expect(result.bestMove).toBeNull();
        expect(result.score).toEqual({ kind: "mate", mate: 0 });
    });

    it("doesn't mistake MultiPV slot 10 for slot 1", () => {
        const raw = [
            "info depth 8 multipv 1 score cp 15 pv e2e4",
            "info depth 8 multipv 10 score cp -90 pv a2a3",
            "bestmove e2e4",
        ].join("\n");
        expect(parseEngineOutput(raw).score).toEqual({ kind: "cp", cp: 15 });
    });

    it("throws instead of inventing a score for a broken reply", () => {
        expect(() => parseEngineOutput("info string NNUE loaded\nbestmove e2e4")).toThrow();
        expect(() => parseEngineOutput("info depth 5 score cp 10 pv e2e4")).toThrow();
    });
});
