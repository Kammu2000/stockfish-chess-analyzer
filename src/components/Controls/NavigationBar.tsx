// libs
import { JSX } from "react";

// components
import { ControlButtons } from "./ControlButtons";

// hooks
import { useGameStore } from "../../store/gameStore";

export const NavigationBar = (): JSX.Element => {
    const currentPly = useGameStore((s) => s.currentPly);
    const game = useGameStore((s) => s.game);

    return (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface/60 border border-panel px-4 py-2">
            <ControlButtons />
            <div className="relative group">
                <span className="text-xs text-muted/80 border-b border-dotted border-muted/50 cursor-help select-none">
                    Shortcuts
                </span>
                <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-panel bg-surface px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                    <p className="font-semibold mb-1">Keyboard shortcuts</p>
                    <ul className="space-y-0.5 text-muted">
                        <li>
                            <span className="font-mono text-white">← / →</span> — previous / next
                            move
                        </li>
                        <li>
                            <span className="font-mono text-white">↑</span> — jump to start
                        </li>
                        <li>
                            <span className="font-mono text-white">↓</span> — jump to last move
                        </li>
                        <li>
                            <span className="font-mono text-white">F</span> — flip board
                        </li>
                        <li>
                            <span className="font-mono text-white">R / A</span> — Report / Analysis
                            tab
                        </li>
                    </ul>
                </div>
            </div>
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
        </div>
    );
};
