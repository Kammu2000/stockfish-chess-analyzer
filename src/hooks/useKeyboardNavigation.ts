// libs
import { useCallback, useEffect } from "react";

// hooks
import { useGameStore } from "../store/gameStore";
import { useUiStore } from "../store/uiStore";

export const useKeyboardNavigation = (): void => {
    const goToNext = useGameStore((s) => s.goToNext);
    const goToPrev = useGameStore((s) => s.goToPrev);
    const goToStart = useGameStore((s) => s.goToStart);
    const goToEnd = useGameStore((s) => s.goToEnd);
    const toggleFlipped = useGameStore((s) => s.toggleFlipped);
    const setActiveTab = useUiStore((s) => s.setActiveTab);

    const onKeyDown = useCallback(
        (e: KeyboardEvent): void => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
            if (useUiStore.getState().settingsOpen) return;

            switch (e.key) {
                case "ArrowRight":
                    e.preventDefault();
                    goToNext();
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    goToPrev();
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    goToStart();
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    goToEnd();
                    break;
                case "f":
                case "F":
                    if (e.metaKey || e.ctrlKey || e.altKey) return;
                    e.preventDefault();
                    toggleFlipped();
                    break;
                case "r":
                case "R":
                case "a":
                case "A":
                    if (e.metaKey || e.ctrlKey || e.altKey) return;
                    e.preventDefault();
                    setActiveTab(e.key.toLowerCase() === "r" ? "report" : "analysis");
                    break;
            }
        },
        [goToNext, goToPrev, goToStart, goToEnd, toggleFlipped, setActiveTab]
    );

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onKeyDown]);
};
