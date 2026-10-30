// libs
import { JSX } from "react";

// components
import { AnalysisPanel } from "../Panel/AnalysisPanel";
import { ChessBoard } from "../Board/ChessBoard";
import { EngineStatus } from "./EngineStatus";
import { NavigationBar } from "../Controls/NavigationBar";
import { PgnUpload } from "../Upload/PgnUpload";
import { SettingsButton } from "../Settings/SettingsButton";

// hooks
import { useGameStore } from "../../store/gameStore";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";

export const AppLayout = (): JSX.Element => {
    useSoundEffects();
    useKeyboardNavigation();

    const game = useGameStore((s) => s.game);

    return (
        <div className="min-h-screen lg:h-screen bg-bg text-white flex flex-col">
            <header className="border-b border-panel/60 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">♟</span>
                    <h1 className="text-base font-bold tracking-tight">Chess Analyzer</h1>
                </div>
                <div className="flex items-center gap-3">
                    <EngineStatus />
                    <SettingsButton />
                </div>
            </header>

            <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
                <div className="flex flex-col gap-4 min-w-0 lg:flex-[7]">
                    <ChessBoard />
                    {game && (
                        <div className="lg:hidden">
                            <NavigationBar />
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 min-w-0 lg:flex-[3] min-h-0">
                    {game ? <AnalysisPanel /> : <PgnUpload />}
                </div>
            </main>
        </div>
    );
};
