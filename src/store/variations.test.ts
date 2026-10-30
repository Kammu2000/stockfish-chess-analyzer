// libs
import { beforeEach, describe, expect, it, vi } from "vitest";

// hooks
import { useAnalysisStore } from "./analysisStore";
import { useGameStore } from "./gameStore";
import { useUiStore } from "./uiStore";
import { playMoveAt } from "./variationActions";

// services
import { engineService } from "../services/engineService";

// utils
import { parsePGN } from "../utils/pgnParser";
import { anchorPly, mainRef, nearestOpening } from "../utils/variations";

// types
import { AnalysisResult, AnalysisStatus, MoveClass, PositionEval, Score } from "../types";

vi.mock("../services/engineService", () => ({
    engineService: { analyzePosition: vi.fn() },
}));
const analyzePosition = vi.mocked(engineService.analyzePosition);

const cp = (value: number): Score => ({ kind: "cp", cp: value });
const engineResult = (score: Score): AnalysisResult => ({
    score,
    bestMove: null,
    depth: 16,
    pv: [],
});

// 1. e4 e5 2. Nf3 Nc6 — main-line plies 0..3.
const LAST_PLY = 3;
const evalAt = (score: Score, bestMove: string | null = null): PositionEval => ({
    score,
    bestMove,
    pv: [],
});

const game = () => useGameStore.getState();
const node = (id: string) => game().variations[id];
const varId = () => game().currentVarId!;

beforeEach(() => {
    analyzePosition.mockReset();
    useGameStore.getState().loadGame(parsePGN("1. e4 e5 2. Nf3 Nc6 *"));
    useAnalysisStore.setState({
        depth: 16,
        phase: {
            status: AnalysisStatus.Done,
            results: [],
            positionEvals: [cp(20), cp(30), cp(30), cp(30), cp(30)].map((s) => evalAt(s, "f1b5")),
            whiteAccuracy: 100,
            blackAccuracy: 100,
        },
    });
    useUiStore.setState({ activeTab: "report" });
});

describe("playMoveAt", () => {
    it("follows the main line instead of creating a variation for the game's next move", () => {
        expect(playMoveAt(mainRef(0), "e7e5")).toBe(true);
        expect(game()).toMatchObject({ currentPly: 1, currentVarId: null, variations: {} });
        expect(analyzePosition).not.toHaveBeenCalled();
    });

    it("rejects illegal moves", () => {
        expect(playMoveAt(mainRef(LAST_PLY), "e1e3")).toBe(false);
        expect(game().variations).toEqual({});
    });

    it("adds a variation, evaluates it at the chosen depth and classifies it", async () => {
        analyzePosition.mockResolvedValue(engineResult(cp(-300)));
        useAnalysisStore.setState({ depth: 18 });

        playMoveAt(mainRef(LAST_PLY), "h2h4");
        const id = varId();

        expect(node(id)).toMatchObject({ status: "pending", move: { san: "h4", ply: 4 } });
        expect(game().currentPly).toBe(LAST_PLY);
        expect(useUiStore.getState().activeTab).toBe("analysis");
        expect(analyzePosition).toHaveBeenCalledWith(node(id).move.fenAfter, 18);

        await vi.waitFor(() => expect(node(id).status).toBe("done"));
        expect(node(id).result?.classification).toBe(MoveClass.Blunder);
    });

    it("reuses an existing variation for the same move", async () => {
        analyzePosition.mockResolvedValue(engineResult(cp(30)));
        playMoveAt(mainRef(LAST_PLY), "h2h4");
        const id = varId();
        game().goToPly(LAST_PLY);

        playMoveAt(mainRef(LAST_PLY), "h2h4");
        expect(varId()).toBe(id);
        expect(Object.keys(game().variations)).toHaveLength(1);
        expect(analyzePosition).toHaveBeenCalledTimes(1);
    });

    it("grades a move played on a still-evaluating move once its parent's eval arrives", async () => {
        let resolveParent!: (r: AnalysisResult) => void;
        analyzePosition
            .mockReturnValueOnce(new Promise((resolve) => (resolveParent = resolve)))
            .mockResolvedValueOnce(engineResult(cp(-400)));

        playMoveAt(mainRef(LAST_PLY), "h2h4");
        const parent = varId();
        playMoveAt({ kind: "var", id: parent }, "f8c5");
        const child = varId();

        // Child's eval is ready, but it can't be graded until the parent's is.
        await Promise.resolve();
        expect(node(child).status).toBe("pending");

        resolveParent(engineResult(cp(30)));
        await vi.waitFor(() => expect(node(child).status).toBe("done"));
        // Black went from -30 (White's +30) to White's -400: a good move for Black.
        expect(node(child).result?.classification).not.toBe(MoveClass.Blunder);
        expect(node(child).result?.scoreBefore).toEqual(cp(30));
    });

    it("marks the variation as errored when the engine fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        analyzePosition.mockRejectedValue(new Error("engine down"));

        playMoveAt(mainRef(LAST_PLY), "h2h4");
        await vi.waitFor(() => expect(node(varId()).status).toBe("error"));
    });
});

describe("variation navigation", () => {
    // Main line 1. e4 e5, then the user explores 2. Nf3 (in the game) vs 2. d4 exd4 3. c3.
    const buildLine = () => {
        analyzePosition.mockResolvedValue(engineResult(cp(30)));
        playMoveAt(mainRef(1), "d2d4");
        const d4 = varId();
        playMoveAt({ kind: "var", id: d4 }, "e5d4");
        const exd4 = varId();
        playMoveAt({ kind: "var", id: exd4 }, "c2c3");
        const c3 = varId();
        return { d4, exd4, c3 };
    };

    it("keeps currentPly at the main-line anchor while inside a variation", () => {
        const { d4, c3 } = buildLine();
        expect(game().currentPly).toBe(1);
        expect(anchorPly(game().variations, c3)).toBe(1);
        expect(node(d4).children).toHaveLength(1);
    });

    it("steps through a line with next/prev/end and back onto the main line", () => {
        const { d4, exd4, c3 } = buildLine();

        game().goToPrev();
        expect(varId()).toBe(exd4);
        game().goToPrev();
        game().goToPrev();
        expect(game()).toMatchObject({ currentVarId: null, currentPly: 1 });

        game().goToVariation(d4);
        game().goToEnd();
        expect(varId()).toBe(c3);
        game().goToNext();
        expect(varId()).toBe(c3);
    });

    it("deletes a variation with everything after it and moves the cursor out", () => {
        const { d4, exd4 } = buildLine();

        game().deleteVariation(exd4);
        expect(Object.keys(game().variations)).toEqual([d4]);
        expect(node(d4).children).toEqual([]);
        expect(varId()).toBe(d4);

        game().deleteVariation(d4);
        expect(game()).toMatchObject({ variations: {}, currentVarId: null, currentPly: 1 });
    });

    it("finds the opening of the nearest book position, through variations to the main line", async () => {
        const { c3 } = buildLine();
        // 2. d4 exd4 3. c3 is the Danish Gambit.
        await vi.waitFor(() => expect(node(c3).status).toBe("done"));
        const results = [{ opening: { eco: "C20", name: "King's Pawn Game" } }];

        expect(
            nearestOpening(game().variations, results as never, { kind: "var", id: c3 })?.name
        ).toMatch(/Danish/);
        expect(nearestOpening({}, results as never, mainRef(1))?.eco).toBe("C20");
    });

    it("is cleared when a new game is loaded", () => {
        buildLine();
        game().loadGame(parsePGN("1. d4 *"));
        expect(game()).toMatchObject({ variations: {}, currentVarId: null, currentPly: -1 });
    });
});
