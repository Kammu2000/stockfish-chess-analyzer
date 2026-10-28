// libs
import { useEffect } from "react";

// hooks
import { usePrevious } from "./usePrevious";
import { useCurrentPosition } from "./useCurrentPosition";

// services & utils & helpers
import { soundService } from "../services/soundService";

export const useSoundEffects = (): void => {
    const { ref, move } = useCurrentPosition();
    // Identifies the displayed position across the main line and variations.
    const key = ref.kind === "var" ? ref.id : `main-${ref.ply}`;
    const ply = move?.ply ?? -1;
    const prevKey = usePrevious(key);
    const prevPly = usePrevious(ply);

    useEffect(() => {
        soundService.preload();
    }, []);

    useEffect(() => {
        if (prevKey === undefined || prevPly === undefined || key === prevKey) return;

        if (ply < prevPly || !move) {
            soundService.playMoveBack();
            return;
        }

        const { san } = move;

        if (san.startsWith("O-O")) {
            soundService.playCastle();
        } else if (san.includes("x")) {
            soundService.playCapture();
        } else if (san.endsWith("+") || san.endsWith("#")) {
            soundService.playCheck();
        } else {
            soundService.playMove();
        }
    }, [key, move, ply, prevKey, prevPly]);
};
