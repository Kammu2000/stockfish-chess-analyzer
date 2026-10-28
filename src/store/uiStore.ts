// libs
import { create } from "zustand";

export type PanelTab = "report" | "analysis";

export interface UiState {
    activeTab: PanelTab;
    settingsOpen: boolean;

    setActiveTab: (tab: PanelTab) => void;
    setSettingsOpen: (open: boolean) => void;
}

// Ephemeral UI state shared across components (tab switches come from the tab bar, the
// "Start review" button, keyboard shortcuts, and analysis start/finish; settingsOpen pauses
// board shortcuts while the settings dialog is up).
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
