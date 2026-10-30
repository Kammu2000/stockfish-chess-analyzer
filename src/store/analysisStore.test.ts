// libs
import { beforeEach, describe, expect, it, vi } from "vitest";

// hooks
import { useAnalysisStore } from "./analysisStore";

// services
import { engineService } from "../services/engineService";

// types
import { AnalysisResult, AnalysisStatus } from "../types";

vi.mock("../services/engineService", () => ({
    engineService: { ready: vi.fn(), analyzeBatch: vi.fn() },
}));
vi.mock("../utils/opening", () => ({
    loadOpeningBook: () => Promise.resolve(() => undefined),
}));
const ready = vi.mocked(engineService.ready);
const analyzeBatch = vi.mocked(engineService.analyzeBatch);

const evals = (positions: string[], cp: number): AnalysisResult[] =>
    positions.map(() => ({ score: { kind: "cp", cp }, bestMove: null, depth: 16, pv: [] }));

const phase = () => useAnalysisStore.getState().phase;
const start = (pgn: string) => useAnalysisStore.getState().startAnalysis(pgn);

beforeEach(() => {
    ready.mockReset().mockResolvedValue();
    analyzeBatch.mockReset();
    useAnalysisStore.setState({ phase: { status: AnalysisStatus.Idle } });
});

describe("startAnalysis", () => {
    it("reports an invalid PGN without waiting for the engine", async () => {
        ready.mockReturnValue(new Promise(() => {}));
        await start("1. e4 e4 *");
        expect(phase().status).toBe(AnalysisStatus.Error);
    });

    it("rejects a PGN with no moves", async () => {
        await start('[White "Alice"]\n\n*');
        expect(phase()).toEqual({
            status: AnalysisStatus.Error,
            error: "The PGN contains no moves.",
        });
    });

    it("never lets a superseded run overwrite a newer one", async () => {
        let finishFirst!: () => void;
        analyzeBatch.mockImplementationOnce(
            (positions) =>
                new Promise((resolve) => (finishFirst = () => resolve(evals(positions, -500))))
        );
        analyzeBatch.mockImplementationOnce(async (positions) => evals(positions, 30));

        const first = start("1. e4 e5 *");
        await vi.waitFor(() => expect(analyzeBatch).toHaveBeenCalledTimes(1));
        await start("1. d4 d5 *");
        finishFirst();
        await first;

        const p = phase();
        expect(p.status).toBe(AnalysisStatus.Done);
        if (p.status === AnalysisStatus.Done) {
            expect(p.results.map((m) => m.san)).toEqual(["d4", "d5"]);
        }
    });

    it("stays idle when cancelled mid-run", async () => {
        let finish!: () => void;
        analyzeBatch.mockImplementationOnce(
            (positions) => new Promise((resolve) => (finish = () => resolve(evals(positions, 0))))
        );

        const run = start("1. e4 e5 *");
        await vi.waitFor(() => expect(analyzeBatch).toHaveBeenCalled());
        useAnalysisStore.getState().cancelAnalysis();
        finish();
        await run;

        expect(phase().status).toBe(AnalysisStatus.Idle);
    });
});
