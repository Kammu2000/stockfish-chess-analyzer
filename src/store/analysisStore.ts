import { create } from "zustand";
import { AnalysisStatus, ClassifiedMove } from "../types";
import { parsePGN } from "../utils/pgnParser";
import { engineService } from "../services/engineService";
import { buildClassifiedMoves, computeAccuracy } from "../utils/moveClassifier";
import { useGameStore } from "./gameStore";
import { DEFAULT_DEPTH } from "../constants/analysis";

export interface AnalysisState {
    status: AnalysisStatus;
    progress: number; // 0–1
    depth: number;
    results: ClassifiedMove[];
    whiteAccuracy: number | null;
    blackAccuracy: number | null;
    error: string | null;

    startAnalysis: (pgn: string) => Promise<void>;
    cancelAnalysis: () => void;
    setDepth: (d: number) => void;
    reset: () => void;
}

let cancelFlag = false;

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
    status: "idle",
    depth: DEFAULT_DEPTH,
    progress: 0,
    results: [],
    whiteAccuracy: null,
    blackAccuracy: null,
    error: null,

    setDepth(d) {
        set({ depth: d });
    },

    reset() {
        cancelFlag = true;

        set({
            status: "idle",
            depth: DEFAULT_DEPTH,
            progress: 0,
            results: [],
            whiteAccuracy: null,
            blackAccuracy: null,
            error: null,
        });
    },

    cancelAnalysis() {
        cancelFlag = true;
        set({ status: "idle" });
    },

    async startAnalysis(pgn: string) {
        cancelFlag = false;

        set({
            status: "analyzing",
            progress: 0,
            results: [],
            whiteAccuracy: null,
            blackAccuracy: null,
            error: null,
        });

        try {
            await engineService.ready();

            const game = parsePGN(pgn);
            useGameStore.setState({ game, currentPly: -1 });

            const { depth } = get();
            const total = game.moves.length;

            // Evaluate N+1 unique positions (start + after each move) instead of 2N.
            // fenAfter[i] === fenBefore[i+1], so reusing halves the engine calls.
            const positions = [game.moves[0].fenBefore, ...game.moves.map((m) => m.fen)];
            const posEvals: { scoreCP: number; bestMove: string; pv: string[] }[] = [];

            for (let i = 0; i < positions.length; i++) {
                if (cancelFlag) break;
                const result = await engineService.analyzePosition(positions[i], depth);
                if (cancelFlag) break;
                posEvals.push({
                    scoreCP: result.scoreCP,
                    bestMove: result.bestMove,
                    pv: result.pv,
                });
                // Progress: each position eval counts as one unit out of N+1
                set({ progress: (i + 1) / positions.length });
            }

            // Reconstruct parallel arrays from position evals
            const evalsBefore = posEvals.slice(0, total).map((e) => e.scoreCP);
            const evalsAfter = posEvals.slice(1, total + 1).map((e) => e.scoreCP);
            const bestMoves = posEvals.slice(0, total).map((e) => e.bestMove);
            const bestEvals = posEvals.slice(0, total).map((e) => e.scoreCP);
            const pvsAfter = posEvals.slice(1, total + 1).map((e) => e.pv);

            if (cancelFlag) {
                set({ status: "idle" });
                return;
            }

            const classifiedMoves = buildClassifiedMoves(
                game.moves.slice(0, evalsBefore.length),
                evalsBefore,
                evalsAfter,
                bestMoves,
                bestEvals,
                pvsAfter
            );

            const whiteAccuracy = computeAccuracy(classifiedMoves, "w");
            const blackAccuracy = computeAccuracy(classifiedMoves, "b");

            set({
                status: "done",
                results: classifiedMoves,
                whiteAccuracy,
                blackAccuracy,
                progress: 1,
            });
        } catch (err) {
            console.error("[AnalysisStore]", err);
            set({ status: "error", error: String(err) });
        }
    },
}));
