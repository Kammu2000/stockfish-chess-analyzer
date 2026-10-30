// libs
import { create } from "zustand";
import { persist } from "zustand/middleware";

// hooks
import { useGameStore } from "./gameStore";
import { useUiStore } from "./uiStore";

// utils
import { parsePGN } from "../utils/pgnParser";
import { buildClassifiedMoves } from "../utils/classification/classifyMoves";
import { computeAccuracy } from "../utils/classification/accuracy";
import { loadOpeningBook, NO_OPENINGS } from "../utils/opening";
import { engineService } from "../services/engineService";

// constants
import { DEFAULT_DEPTH, DEPTH_OPTIONS } from "../constants/analysis";
import { STORAGE_KEYS, STORAGE_PREFIX } from "../constants/storage";

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

// The in-flight run. Each run owns its controller
let activeRun: AbortController | null = null;

const abortActiveRun = (): void => {
    activeRun?.abort();
    activeRun = null;
};

export const useAnalysisStore = create<AnalysisState>()(
    persist(
        (set, get) => ({
            phase: { status: AnalysisStatus.Idle },
            depth: DEFAULT_DEPTH,

            setDepth(d) {
                set({ depth: d });
            },

            reset() {
                abortActiveRun();
                set({ phase: { status: AnalysisStatus.Idle } });
            },

            cancelAnalysis() {
                get().reset();
            },

            async startAnalysis(pgn: string) {
                abortActiveRun();
                const run = new AbortController();
                activeRun = run;
                const { signal } = run;
                set({ phase: { status: AnalysisStatus.Analyzing, progress: 0 } });

                // Fetch the opening book in parallel with engine analysis. It's optional: if it
                // fails to load, moves are just graded normally instead of being marked Theory.
                const openingBook = loadOpeningBook().catch((err) => {
                    console.warn("[AnalysisStore] opening book unavailable", err);
                    return NO_OPENINGS;
                });

                try {
                    const game = parsePGN(pgn);
                    if (game.moves.length === 0) throw new Error("The PGN contains no moves.");

                    useGameStore.getState().loadGame(game);
                    useUiStore.setState({ activeTab: "report" });

                    await engineService.ready();

                    // N+1 unique positions instead of 2N: fenAfter[i] === fenBefore[i+1].
                    const positions = [
                        game.moves[0].fenBefore,
                        ...game.moves.map((m) => m.fenAfter),
                    ];

                    const positionEvals: PositionEval[] = await engineService.analyzeBatch(
                        positions,
                        get().depth,
                        (completed, positionCount) => {
                            if (signal.aborted) return;
                            set({
                                phase: {
                                    status: AnalysisStatus.Analyzing,
                                    progress: completed / positionCount,
                                },
                            });
                        },
                        signal
                    );

                    const classifiedMoves = buildClassifiedMoves(
                        game.moves,
                        positionEvals,
                        await openingBook
                    );
                    if (signal.aborted) return;

                    set({
                        phase: {
                            status: AnalysisStatus.Done,
                            results: classifiedMoves,
                            positionEvals,
                            whiteAccuracy: computeAccuracy(classifiedMoves, "w"),
                            blackAccuracy: computeAccuracy(classifiedMoves, "b"),
                        },
                    });
                    useUiStore.setState({ activeTab: "report" });
                } catch (err) {
                    if (signal.aborted) return; // cancelled, or superseded by a newer run
                    console.error("[AnalysisStore]", err);
                    set({
                        phase: {
                            status: AnalysisStatus.Error,
                            error: err instanceof Error ? err.message : String(err),
                        },
                    });
                } finally {
                    if (activeRun === run) activeRun = null;
                }
            },
        }),
        {
            name: STORAGE_PREFIX + STORAGE_KEYS.analysisSettings,
            version: 1,
            partialize: (s) => ({ depth: s.depth }),
            merge: (persisted, current) => {
                const depth = (persisted as Partial<AnalysisState> | undefined)?.depth;
                return DEPTH_OPTIONS.includes(depth as number)
                    ? { ...current, depth: depth as number }
                    : current;
            },
        }
    )
);
