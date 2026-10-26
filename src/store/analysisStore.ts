// libs
import { create } from "zustand";

// hooks
import { useGameStore } from "./gameStore";

// utils
import { parsePGN } from "../utils/pgnParser";
import { buildClassifiedMoves, computeAccuracy } from "../utils/moveClassifier";
import { engineService } from "../services/engineService";

// constants
import { DEFAULT_DEPTH } from "../constants/analysis";

// types
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

            const results = await engineService.analyzeBatch(
                positions,
                depth,
                (completed, positionCount) => {
                    set({
                        phase: {
                            status: AnalysisStatus.Analyzing,
                            progress: completed / positionCount,
                        },
                    });
                },
                () => cancelFlag
            );

            if (cancelFlag) {
                set({ phase: { status: AnalysisStatus.Idle } });
                return;
            }

            const posEvals: PositionEval[] = results.map((result) => {
                if (!result) throw new Error("Analysis incomplete: missing position evaluation");
                return {
                    score: result.score,
                    secondScore: result.secondScore,
                    bestMove: result.bestMove,
                    pv: result.pv,
                };
            });

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
