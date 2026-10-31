// libs
import { create } from "zustand";
import { persist } from "zustand/middleware";

// services
import { engineService, EngineVariant } from "../services/engineService";

// constants
import { STORAGE_KEYS, STORAGE_PREFIX } from "../constants/storage";

// User display preferences edited in the settings dialog. Engine depth lives in analysisStore
// because the analysis pipeline reads it; add new display/board options here.
export interface SettingsState {
    showBestMoveArrow: boolean;
    engineVariant: EngineVariant;

    setShowBestMoveArrow: (show: boolean) => void;
    setEngineVariant: (variant: EngineVariant) => void;
}

const isEngineVariant = (v: unknown): v is EngineVariant => v === "lite" || v === "rich";

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            showBestMoveArrow: true,
            engineVariant: "lite",

            setShowBestMoveArrow(show) {
                set({ showBestMoveArrow: show });
            },

            setEngineVariant(variant) {
                engineService.setVariant(variant);
                set({ engineVariant: variant });
            },
        }),
        {
            name: STORAGE_PREFIX + STORAGE_KEYS.settings,
            version: 1,
            partialize: (s) => ({
                showBestMoveArrow: s.showBestMoveArrow,
                engineVariant: s.engineVariant,
            }),
            merge: (persisted, current) => {
                const p = persisted as Partial<SettingsState> | undefined;
                const showBestMoveArrow =
                    typeof p?.showBestMoveArrow === "boolean"
                        ? p.showBestMoveArrow
                        : current.showBestMoveArrow;
                const engineVariant = isEngineVariant(p?.engineVariant)
                    ? p.engineVariant
                    : current.engineVariant;
                return { ...current, showBestMoveArrow, engineVariant };
            },
        }
    )
);

// localStorage is synchronous, so hydration already finished during create() above — this
// onFinishHydration listener registers too late to fire. Apply the hydrated variant directly
// instead; keep the listener too, in case storage is ever swapped for something async.
useSettingsStore.persist.onFinishHydration((state) => {
    engineService.setVariant(state.engineVariant);
});
engineService.setVariant(useSettingsStore.getState().engineVariant);
