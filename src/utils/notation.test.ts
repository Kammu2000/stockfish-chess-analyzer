// libs
import { describe, expect, it } from "vitest";

// utils
import { formatUciLine, involvesPromotion, uciToSan } from "./notation";

// constants
import { START_FEN } from "../constants/board";

const PROMO_FEN = "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1";

describe("uciToSan", () => {
    it("converts UCI moves to SAN, including promotions and checks", () => {
        expect(uciToSan(START_FEN, "g1f3")).toBe("Nf3");
        expect(uciToSan(PROMO_FEN, "b7b8q")).toBe("b8=Q+");
        expect(uciToSan(PROMO_FEN, "b7b8n")).toBe("b8=N");
    });

    it("returns null for an illegal move", () => {
        expect(uciToSan(START_FEN, "e2e5")).toBeNull();
    });
});

describe("formatUciLine", () => {
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

    it("numbers moves, using '...' when the line starts with Black", () => {
        expect(formatUciLine(START_FEN, ["e2e4", "e7e5", "g1f3"])).toBe("1. e4 e5 2. Nf3");
        expect(formatUciLine(afterE4, ["e7e5", "g1f3", "b8c6"])).toBe("1... e5 2. Nf3 Nc6");
    });

    it("respects maxPlies and stops at the first illegal move", () => {
        expect(formatUciLine(START_FEN, ["e2e4", "e7e5", "g1f3"], 2)).toBe("1. e4 e5");
        expect(formatUciLine(START_FEN, ["e2e4", "e2e4", "g1f3"])).toBe("1. e4");
    });
});

describe("involvesPromotion", () => {
    const promoted = "1N2k3/8/8/8/8/8/8/4K3 b - - 0 1";
    const captured = "4k3/8/8/8/8/8/8/4K3 b - - 0 1";

    it("detects a promotion in either direction", () => {
        expect(involvesPromotion(PROMO_FEN, promoted)).toBe(true);
        expect(involvesPromotion(promoted, PROMO_FEN)).toBe(true);
    });

    it("ignores captures and unchanged positions", () => {
        expect(involvesPromotion(PROMO_FEN, captured)).toBe(false);
        expect(involvesPromotion(PROMO_FEN, PROMO_FEN)).toBe(false);
    });
});
