import { create } from "zustand";
import { AnalysisPhase, Score } from "../types";
import { parsePGN } from "../utils/pgnParser";
import { engineService } from "../services/engineService";
import { buildClassifiedMoves, computeAccuracy } from "../utils/moveClassifier";
import { useGameStore } from "./gameStore";
import { DEFAULT_DEPTH } from "../constants/analysis";

export interface AnalysisState {
    phase: AnalysisPhase;
    depth: number;

    startAnalysis: (pgn: string) => Promise<void>;
    cancelAnalysis: () => void;
    setDepth: (d: number) => void;
    reset: () => void;
}

let cancelFlag = false;

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
    phase: { status: "idle" },
    depth: DEFAULT_DEPTH,

    setDepth(d) {
        set({ depth: d });
    },

    reset() {
        cancelFlag = true;
        set({ phase: { status: "idle" }, depth: DEFAULT_DEPTH });
    },

    cancelAnalysis() {
        cancelFlag = true;
        set({ phase: { status: "idle" } });
    },

    async startAnalysis(pgn: string) {
        cancelFlag = false;
        set({ phase: { status: "analyzing", progress: 0 } });

        try {
            await engineService.ready();

            const game = parsePGN(pgn);
            useGameStore.setState({ game, currentPly: -1 });

            const { depth } = get();
            const total = game.moves.length;

            // Evaluate N+1 unique positions (start + after each move) instead of 2N.
            // fenAfter[i] === fenBefore[i+1], so reusing halves the engine calls.
            const positions = [game.moves[0].fenBefore, ...game.moves.map((m) => m.fen)];
            const posEvals: { score: Score; bestMove: string | null; pv: string[] }[] = [];

            for (let i = 0; i < positions.length; i++) {
                if (cancelFlag) break;
                const result = await engineService.analyzePosition(positions[i], depth);
                if (cancelFlag) break;
                posEvals.push({ score: result.score, bestMove: result.bestMove, pv: result.pv });
                set({ phase: { status: "analyzing", progress: (i + 1) / positions.length } });
            }

            if (cancelFlag) {
                set({ phase: { status: "idle" } });
                return;
            }

            // Reconstruct parallel arrays from position evals
            const scoresBefore = posEvals.slice(0, total).map((e) => e.score);
            const scoresAfter = posEvals.slice(1, total + 1).map((e) => e.score);
            const bestMoves = posEvals.slice(0, total).map((e) => e.bestMove);
            const pvsAfter = posEvals.slice(1, total + 1).map((e) => e.pv);

            const classifiedMoves = buildClassifiedMoves(
                game.moves.slice(0, scoresBefore.length),
                scoresBefore,
                scoresAfter,
                bestMoves,
                pvsAfter
            );

            const whiteAccuracy = computeAccuracy(classifiedMoves, "w");
            const blackAccuracy = computeAccuracy(classifiedMoves, "b");

            set({
                phase: { status: "done", results: classifiedMoves, whiteAccuracy, blackAccuracy },
            });
        } catch (err) {
            console.error("[AnalysisStore]", err);
            set({ phase: { status: "error", error: String(err) } });
        }
    },
}));
