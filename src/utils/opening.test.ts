// libs
import { describe, expect, it } from "vitest";

// utils
import { loadOpeningBook } from "./opening";

describe("loadOpeningBook", () => {
    it("looks positions up by piece placement only, so move counters don't matter", async () => {
        const lookup = await loadOpeningBook();
        const sicilian = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2";

        expect(lookup(sicilian)).toEqual({ eco: "B20", name: "Sicilian Defense" });
        expect(lookup(sicilian.replace("c6 0 2", "- 4 9"))).toEqual(lookup(sicilian));
    });

    it("returns undefined for positions outside the book", async () => {
        const lookup = await loadOpeningBook();
        expect(lookup("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBeUndefined();
    });
});
