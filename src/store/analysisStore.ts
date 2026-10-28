// libs
import { create } from "zustand";
import { persist } from "zustand/middleware";

// hooks
import { useGameStore } from "./gameStore";
import { useUiStore } from "./uiStore";

// utils
import { parsePGN } from "../utils/pgnParser";
import { buildClassifiedMoves, computeAccuracy } from "../utils/moveClassifier";
import { loadOpeningBook, OpeningLookup } from "../utils/opening";
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

let cancelFlag = false;

export const useAnalysisStore = create<AnalysisState>()(
    persist(
        (set, get) => ({
            phase: { status: AnalysisStatus.Idle },
            depth: DEFAULT_DEPTH,

            setDepth(d) {
                set({ depth: d });
            },

            // Depth is a user preference, so it survives "New game" (and reloads, via persist below).
            reset() {
                cancelFlag = true;
                set({ phase: { status: AnalysisStatus.Idle } });
            },

            cancelAnalysis() {
                cancelFlag = true;
                set({ phase: { status: AnalysisStatus.Idle } });
            },

            async startAnalysis(pgn: string) {
                cancelFlag = false;
                set({ phase: { status: AnalysisStatus.Analyzing, progress: 0 } });

                // Fetch the opening book in parallel with engine analysis. It's optional: if it
                // fails to load, moves are just graded normally instead of being marked Theory.
                const openingBook: Promise<OpeningLookup | undefined> = loadOpeningBook().catch(
                    (err) => {
                        console.warn("[AnalysisStore] opening book unavailable", err);
                        return undefined;
                    }
                );

                try {
                    await engineService.ready();

                    const game = parsePGN(pgn);
                    useGameStore.setState({ game, currentPly: -1 });
                    // Report first (chess.com-style summary): skeletons while analysing, and
                    // switched back to on completion.
                    useUiStore.setState({ activeTab: "report" });

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
                        if (!result)
                            throw new Error("Analysis incomplete: missing position evaluation");
                        return {
                            score: result.score,
                            secondScore: result.secondScore,
                            bestMove: result.bestMove,
                            pv: result.pv,
                        };
                    });

                    const classifiedMoves = buildClassifiedMoves(
                        game.moves.slice(0, total),
                        posEvals,
                        await openingBook
                    );

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
                    useUiStore.setState({ activeTab: "report" });
                } catch (err) {
                    console.error("[AnalysisStore]", err);
                    set({ phase: { status: AnalysisStatus.Error, error: String(err) } });
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
