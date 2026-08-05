// components
import { ChessBoard } from "../Board/ChessBoard";
import { AccuracyCard } from "../Analysis/AccuracyCard";
import { AnalysisProgress } from "../Analysis/AnalysisProgress";
import { MoveList } from "../Analysis/MoveList";
import { MoveDetail } from "../Analysis/MoveDetail";
import { NavigationBar } from "../Controls/NavigationBar";
import { PgnUpload } from "../Upload/PgnUpload";
import { EngineStatus } from "./EngineStatus";

// hooks
import { useSoundEffects } from "../../hooks/useSoundEffects";
import { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";

export const AppLayout = (): JSX.Element => {
  useSoundEffects();
  useKeyboardNavigation();

  return (
    <div className="min-h-screen bg-bg text-white flex flex-col">
      <header className="border-b border-panel/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">♟</span>
          <h1 className="text-base font-bold tracking-tight">Chess Analyzer</h1>
        </div>
        <EngineStatus />
      </header>

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-col gap-4 min-w-0 lg:flex-[7]">
          <ChessBoard />
          <NavigationBar />
          <MoveDetail />
        </div>

        <div className="flex flex-col gap-4 min-w-0 lg:flex-[3] min-h-0">
          <AnalysisProgress />
          <AccuracyCard />
          <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-surface/40 border border-panel overflow-hidden">
            <div className="px-4 py-2.5 border-b border-panel shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Moves</h2>
            </div>
            <MoveList />
          </div>
          <PgnUpload />
        </div>
      </main>
    </div>
  );
};
