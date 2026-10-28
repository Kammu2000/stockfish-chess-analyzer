// libs
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

// utils
import { buildClassifiedMoves, computeAccuracy } from "./moveClassifier";

// constants
import { START_FEN } from "../constants/board";

// types
import { ClassifiedMove, MoveClass, MoveNode, PositionEval, Score } from "../types";

const cp = (value: number): Score => ({ kind: "cp", cp: value });
const mate = (value: number): Score => ({ kind: "mate", mate: value });

const moveFrom = (fenBefore: string, san: string, ply = 0): MoveNode => {
    const board = new Chess(fenBefore);
    const m = board.move(san);
    return {
        san: m.san,
        uci: m.from + m.to + (m.promotion ?? ""),
        fen: board.fen(),
        fenBefore,
        ply,
    };
};

const positionEval = (
    score: Score,
    bestMove: string | null = null,
    secondScore?: Score
): PositionEval => ({ score, bestMove, secondScore, pv: [] });

const classify = (
    move: MoveNode,
    before: PositionEval,
    scoreAfter: Score,
    lookupOpening?: Parameters<typeof buildClassifiedMoves>[2]
): MoveClass =>
    buildClassifiedMoves([move], [before, positionEval(scoreAfter)], lookupOpening)[0]
        .classification;

// 1.e4 from the start, with the engine preferring something else.
const e4 = moveFrom(START_FEN, "e4");
const notBest = (score: Score) => positionEval(score, "d2d4");

describe("buildClassifiedMoves", () => {
    it.each([
        [cp(20), MoveClass.Excellent],
        [cp(-20), MoveClass.Good],
        [cp(-80), MoveClass.Inaccuracy],
        [cp(-200), MoveClass.Mistake],
        [cp(-400), MoveClass.Blunder],
    ])("grades a non-best move by expected points lost (after %o -> %s)", (after, expected) => {
        expect(classify(e4, notBest(cp(30)), after)).toBe(expected);
    });

    it("judges Black's moves from Black's point of view (scores are White-absolute)", () => {
        const e5 = moveFrom(e4.fen, "e5", 1);
        expect(classify(e5, positionEval(cp(-30), "c7c5"), cp(-20))).toBe(MoveClass.Excellent);
        expect(classify(e5, positionEval(cp(-30), "c7c5"), cp(400))).toBe(MoveClass.Blunder);
    });

    it("grades the engine's top move as Best regardless of eval drift", () => {
        expect(classify(e4, positionEval(cp(30), "e2e4"), cp(-50))).toBe(MoveClass.Best);
    });

    it.each([
        [mate(-2), MoveClass.Blunder],
        [mate(-4), MoveClass.Mistake],
        [mate(-8), MoveClass.Inaccuracy],
        [mate(3), MoveClass.Best],
    ])("cp -> mate transition (after %o -> %s)", (after, expected) => {
        expect(classify(e4, notBest(cp(50)), after)).toBe(expected);
    });

    it.each([
        [cp(900), MoveClass.Excellent],
        [cp(500), MoveClass.Good],
        [cp(250), MoveClass.Inaccuracy],
        [cp(50), MoveClass.Mistake],
        [cp(-100), MoveClass.Blunder],
        [mate(-2), MoveClass.Blunder],
        [mate(-5), MoveClass.Mistake],
    ])("losing a forced mate (after %o -> %s)", (after, expected) => {
        expect(classify(e4, notBest(mate(3)), after)).toBe(expected);
    });

    it.each([
        [mate(3), mate(2), MoveClass.Best],
        [mate(3), mate(3), MoveClass.Excellent],
        [mate(3), mate(6), MoveClass.Good],
        [mate(3), mate(12), MoveClass.Inaccuracy],
        [mate(-3), mate(-3), MoveClass.Best],
        [mate(-3), mate(-1), MoveClass.Good],
    ])("mate distance: %o -> %o is %s", (before, after, expected) => {
        expect(classify(e4, notBest(before), after)).toBe(expected);
    });

    it("grades a checkmating move as Best even with Stockfish's 'mate 0' sentinel", () => {
        const board = new Chess();
        ["f3", "e5", "g4"].forEach((san) => board.move(san));
        const qh4 = moveFrom(board.fen(), "Qh4#", 3);
        expect(classify(qh4, positionEval(mate(-1), null), mate(0))).toBe(MoveClass.Best);
    });

    it("grades the only legal move as Forced, even inside an opening book line", () => {
        const kxb2 = moveFrom("k7/8/8/8/8/8/1r6/K7 w - - 0 1", "Kxb2");
        const book = () => ({ eco: "A00", name: "Test" });
        expect(classify(kxb2, notBest(cp(0)), cp(-900), book)).toBe(MoveClass.Forced);
    });

    it("grades book positions as Theory and attaches the opening", () => {
        const opening = { eco: "B00", name: "King's Pawn Game" };
        const [result] = buildClassifiedMoves(
            [e4],
            [notBest(cp(30)), positionEval(cp(-300))],
            (fen) => (fen === e4.fen ? opening : undefined)
        );
        expect(result.classification).toBe(MoveClass.Theory);
        expect(result.opening).toEqual(opening);
    });

    it("upgrades a best move to Critical only when the runner-up is much worse", () => {
        expect(classify(e4, positionEval(cp(30), "e2e4", cp(-150)), cp(30))).toBe(
            MoveClass.Critical
        );
        expect(classify(e4, positionEval(cp(30), "e2e4", cp(10)), cp(30))).toBe(MoveClass.Best);
        // Still comfortably winning without it: not critical.
        expect(classify(e4, positionEval(cp(900), "e2e4", cp(750)), cp(900))).toBe(MoveClass.Best);
    });

    describe("Brilliant", () => {
        // Italian Game: Bxf7+ leaves the bishop en prise.
        const italian = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5";
        const bxf7 = moveFrom(italian, "Bxf7+", 8);

        it("is a best move that sacrifices material", () => {
            expect(classify(bxf7, positionEval(cp(50), bxf7.uci), cp(50))).toBe(
                MoveClass.Brilliant
            );
        });

        it("is not awarded when the sacrifice leaves the mover losing", () => {
            expect(classify(bxf7, positionEval(cp(50), bxf7.uci), cp(-200))).toBe(MoveClass.Best);
        });

        it("is not awarded for a best move that risks nothing", () => {
            const castle = moveFrom(italian, "O-O", 8);
            expect(classify(castle, positionEval(cp(50), castle.uci), cp(50))).toBe(MoveClass.Best);
        });
    });
});

describe("computeAccuracy", () => {
    // Plays `sans` from the start, with White-absolute evals for each position (sans.length + 1).
    const game = (sans: string[], scores: Score[]): ClassifiedMove[] => {
        const board = new Chess();
        return sans.map((san, ply) => {
            const move = moveFrom(board.fen(), san, ply);
            board.move(san);
            return {
                ...move,
                scoreBefore: scores[ply],
                scoreAfter: scores[ply + 1],
                bestMove: null,
                classification: MoveClass.Best,
                pvAfter: [],
            };
        });
    };
    const sans = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"];

    it("gives 100% when no move loses ground", () => {
        const moves = game(sans, sans.map(() => cp(30)).concat(cp(30)));
        expect(computeAccuracy(moves, "w")).toBe(100);
        expect(computeAccuracy(moves, "b")).toBe(100);
    });

    it("penalises only the side that blundered", () => {
        const scores = [cp(30), cp(30), cp(30), cp(-400), cp(-400), cp(-400), cp(-400)];
        const moves = game(sans, scores);
        expect(computeAccuracy(moves, "w")).toBeLessThan(80);
        expect(computeAccuracy(moves, "b")).toBe(100);
    });

    it("doesn't penalise the side that delivers mate ('mate 0' after Black mates)", () => {
        const moves = game(
            ["f3", "e5", "g4", "Qh4#"],
            [cp(0), cp(-80), cp(-80), mate(-1), mate(0)]
        );
        expect(computeAccuracy(moves, "b")).toBe(100);
    });

    it("returns 100 for a side with no moves", () => {
        expect(computeAccuracy(game(["e4"], [cp(30), cp(30)]), "b")).toBe(100);
    });
});
