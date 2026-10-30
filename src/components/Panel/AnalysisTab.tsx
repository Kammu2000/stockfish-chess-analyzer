// libs
import { JSX } from "react";

// components
import { MoveList } from "../Analysis/MoveList";

export const AnalysisTab = (): JSX.Element => (
    <div className="h-full min-h-[320px] flex flex-col rounded-xl bg-surface/40 border border-panel overflow-hidden">
        <MoveList />
    </div>
);
