import { create } from "zustand";
import { useGameStore } from "./gameStore";
import { parsePGN } from "../utils/pgnParser";
import { buildClassifiedMoves, computeAccuracy } from "../utils/moveClassifier";
import { engineService } from "../services/engineService";
import { DEFAULT_DEPTH } from "../constants/analysis";
import { AnalysisPhase, AnalysisStatus, PositionEval } from "../types";

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
    phase: { status: AnalysisStatus.Idle },
    depth: DEFAULT_DEPTH,

    setDepth(d) {
        set({ depth: d });
    },

    reset() {
        cancelFlag = true;
        set({ phase: { status: AnalysisStatus.Idle }, depth: DEFAULT_DEPTH });
    },

    cancelAnalysis() {
        cancelFlag = true;
        set({ phase: { status: AnalysisStatus.Idle } });
    },

    async startAnalysis(pgn: string) {
        cancelFlag = false;
        set({ phase: { status: AnalysisStatus.Analyzing, progress: 0 } });

        try {
            await engineService.ready();

            const game = parsePGN(pgn);
            useGameStore.setState({ game, currentPly: -1 });

            const { depth } = get();
            const total = game.moves.length;

            // N+1 unique positions instead of 2N: fenAfter[i] === fenBefore[i+1].
            const positions = [game.moves[0].fenBefore, ...game.moves.map((m) => m.fen)];
            const posEvals: PositionEval[] = [];

            for (let i = 0; i < positions.length; i++) {
                if (cancelFlag) break;
                const result = await engineService.analyzePosition(positions[i], depth);
                if (cancelFlag) break;
                posEvals.push({
                    score: result.score,
                    secondScore: result.secondScore,
                    bestMove: result.bestMove,
                    pv: result.pv,
                });
                set({
                    phase: {
                        status: AnalysisStatus.Analyzing,
                        progress: (i + 1) / positions.length,
                    },
                });
            }

            if (cancelFlag) {
                set({ phase: { status: AnalysisStatus.Idle } });
                return;
            }

            const classifiedMoves = buildClassifiedMoves(game.moves.slice(0, total), posEvals);

            const whiteAccuracy = computeAccuracy(classifiedMoves, "w");
            const blackAccuracy = computeAccuracy(classifiedMoves, "b");

            set({
                phase: {
                    status: AnalysisStatus.Done,
                    results: classifiedMoves,
                    whiteAccuracy,
                    blackAccuracy,
                },
            });
        } catch (err) {
            console.error("[AnalysisStore]", err);
            set({ phase: { status: AnalysisStatus.Error, error: String(err) } });
        }
    },
}));
