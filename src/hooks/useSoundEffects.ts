// libs
import { useEffect, useRef } from "react";

// hooks
import { useCurrentPosition } from "./useCurrentPosition";

// services & utils & helpers
import { soundService } from "../services/soundService";

export const useSoundEffects = (): void => {
    const { ref, move } = useCurrentPosition();
    const key = ref.kind === "var" ? ref.id : `main-${ref.ply}`;
    const ply = move?.ply ?? -1;
    const lastPosition = useRef<{ key: string; ply: number } | null>(null);

    useEffect(() => {
        soundService.preload();
    }, []);

    useEffect(() => {
        const last = lastPosition.current;
        lastPosition.current = { key, ply };
        if (!last || key === last.key) return;

        if (ply < last.ply || !move) {
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
    }, [key, move, ply]);
};
