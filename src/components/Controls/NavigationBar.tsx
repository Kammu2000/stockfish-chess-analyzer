// components
import { ControlButtons } from "./ControlButtons";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useAnalysisStore } from "../../store/analysisStore";

// constants
import { DEPTH_OPTIONS } from "../../constants/analysis";

export const NavigationBar = (): JSX.Element => {
    const currentPly = useGameStore((s) => s.currentPly);
    const game = useGameStore((s) => s.game);

    const depth = useAnalysisStore((s) => s.depth);
    const status = useAnalysisStore((s) => s.status);
    const setDepth = useAnalysisStore((s) => s.setDepth);

    return (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface/60 border border-panel px-4 py-2">
            <ControlButtons />
            {game && (
                <span className="text-xs text-muted font-mono">
                    {currentPly < 0
                        ? "—"
                        : `${Math.floor(currentPly / 2) + 1}${currentPly % 2 === 0 ? "w" : "b"}`}
                    {" / "}
                    {Math.floor((game.moves.length - 1) / 2) + 1}
                    {(game.moves.length - 1) % 2 === 0 ? "w" : "b"}
                </span>
            )}

            <div className="flex items-center gap-2">
                <label className="text-xs text-muted">Depth</label>
                <select
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                    disabled={status === "analyzing"}
                    className="bg-panel border border-panel/80 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-accent disabled:opacity-50"
                >
                    {DEPTH_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                            {d}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};
