// libs
import { afterEach, describe, expect, it, vi } from "vitest";

// constants
import { STORAGE_KEYS, STORAGE_PREFIX } from "../constants/storage";

vi.mock("../services/engineService", () => ({
    engineService: { setVariant: vi.fn() },
}));

// Regression: a persisted "rich" choice must reach engineService on load, not just the store
// state. See the comment in settingsStore.ts — onFinishHydration registers too late to fire.
describe("settingsStore engine variant on load", () => {
    afterEach(() => {
        vi.resetModules();
        localStorage.clear();
    });

    it("applies a persisted non-default variant to engineService as soon as the module loads", async () => {
        localStorage.setItem(
            STORAGE_PREFIX + STORAGE_KEYS.settings,
            JSON.stringify({ state: { engineVariant: "rich" }, version: 1 })
        );

        const { engineService } = await import("../services/engineService");
        const { useSettingsStore } = await import("./settingsStore");

        expect(useSettingsStore.getState().engineVariant).toBe("rich");
        expect(engineService.setVariant).toHaveBeenCalledWith("rich");
    });

    it("applies the default variant when nothing was persisted", async () => {
        const { engineService } = await import("../services/engineService");
        const { useSettingsStore } = await import("./settingsStore");

        expect(useSettingsStore.getState().engineVariant).toBe("lite");
        expect(engineService.setVariant).toHaveBeenCalledWith("lite");
    });
});
