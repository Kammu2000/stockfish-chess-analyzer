// libs
import { JSX } from "react";

// components
import { AnalysisError } from "../Analysis/AnalysisError";
import { AnalysisProgress } from "../Analysis/AnalysisProgress";
import { AnalysisTab } from "./AnalysisTab";
import { MoveCard } from "../Analysis/MoveCard";
import { NavigationBar } from "../Controls/NavigationBar";
import { PanelToolbar } from "./PanelToolbar";
import { ReportTab } from "./ReportTab";
import { TabBar } from "./TabBar";

// hooks
import { useUiStore } from "../../store/uiStore";

export const AnalysisPanel = (): JSX.Element => {
    const activeTab = useUiStore((s) => s.activeTab);

    return (
        <div className="flex flex-col gap-3 min-h-0 lg:h-full">
            <PanelToolbar />
            <TabBar />
            <AnalysisProgress />
            <AnalysisError />
            {activeTab === "analysis" && <MoveCard />}

            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                {activeTab === "report" ? <ReportTab /> : <AnalysisTab />}
            </div>

            <div className="hidden lg:block shrink-0">
                <NavigationBar />
            </div>
        </div>
    );
};
