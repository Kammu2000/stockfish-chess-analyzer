// libs
import { useCallback, useEffect } from "react";

// hooks
import { useGameStore } from "../store/gameStore";

export const useKeyboardNavigation = (): void => {
  const goToNext = useGameStore((s) => s.goToNext);
  const goToPrev = useGameStore((s) => s.goToPrev);
  const goToStart = useGameStore((s) => s.goToStart);
  const goToEnd = useGameStore((s) => s.goToEnd);

  const onKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

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
      }
    },
    [goToNext, goToPrev, goToStart, goToEnd]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);
};
