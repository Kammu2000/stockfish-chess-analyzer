// libs
import { JSX } from "react";

// components
import { IconFlip } from "../Controls/ControlButtons";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useGameStore } from "../../store/gameStore";

export const PanelToolbar = (): JSX.Element => {
    const toggleFlipped = useGameStore((s) => s.toggleFlipped);
    const resetGame = useGameStore((s) => s.reset);
    const resetAnalysis = useAnalysisStore((s) => s.reset);

    const newGame = (): void => {
        resetAnalysis();
        resetGame();
    };

    return (
        <div className="flex items-center gap-2 shrink-0">
            <button
                onClick={newGame}
                className="text-xs text-muted hover:text-accent transition-colors"
                title="Analyze another game"
            >
                ← New Game
            </button>
            <h2 className="flex-1 text-center text-xs font-semibold uppercase tracking-wider text-muted">
                Game Review
            </h2>
            <button
                onClick={toggleFlipped}
                className="flex items-center justify-center w-7 h-7 rounded-full border border-panel text-muted hover:text-white hover:border-accent/60 transition"
                title="Flip board (F)"
            >
                <IconFlip />
            </button>
        </div>
    );
};
