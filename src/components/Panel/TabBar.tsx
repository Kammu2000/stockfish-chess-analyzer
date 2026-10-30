// libs
import { JSX } from "react";

// hooks
import { PanelTab, useUiStore } from "../../store/uiStore";

const TABS: { key: PanelTab; label: string; shortcut: string }[] = [
    { key: "report", label: "Report", shortcut: "R" },
    { key: "analysis", label: "Analysis", shortcut: "A" },
];

export const TabBar = (): JSX.Element => {
    const activeTab = useUiStore((s) => s.activeTab);
    const setActiveTab = useUiStore((s) => s.setActiveTab);

    return (
        <div className="flex gap-1 rounded-lg bg-surface/60 border border-panel p-1 shrink-0">
            {TABS.map(({ key, label, shortcut }) => (
                <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    title={`${label} (${shortcut})`}
                    className={[
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        activeTab === key ? "bg-accent text-white" : "text-muted hover:text-white",
                    ].join(" ")}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};
