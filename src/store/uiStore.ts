// libs
import { create } from "zustand";

export type PanelTab = "report" | "analysis";

export interface UiState {
    activeTab: PanelTab;
    settingsOpen: boolean;

    setActiveTab: (tab: PanelTab) => void;
    setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
    activeTab: "report",
    settingsOpen: false,

    setActiveTab(tab) {
        set({ activeTab: tab });
    },

    setSettingsOpen(open) {
        set({ settingsOpen: open });
    },
}));
