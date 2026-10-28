// libs
import { create } from "zustand";
import { persist } from "zustand/middleware";

// constants
import { STORAGE_KEYS, STORAGE_PREFIX } from "../constants/storage";

// User display preferences edited in the settings dialog. Engine depth lives in analysisStore
// because the analysis pipeline reads it; add new display/board options here.
export interface SettingsState {
    showBestMoveArrow: boolean;

    setShowBestMoveArrow: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            showBestMoveArrow: true,

            setShowBestMoveArrow(show) {
                set({ showBestMoveArrow: show });
            },
        }),
        {
            name: STORAGE_PREFIX + STORAGE_KEYS.settings,
            version: 1,
            partialize: (s) => ({ showBestMoveArrow: s.showBestMoveArrow }),
            merge: (persisted, current) => {
                const show = (persisted as Partial<SettingsState> | undefined)?.showBestMoveArrow;
                return typeof show === "boolean"
                    ? { ...current, showBestMoveArrow: show }
                    : current;
            },
        }
    )
);
