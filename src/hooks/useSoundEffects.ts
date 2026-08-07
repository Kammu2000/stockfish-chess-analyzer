// libs
import { useEffect } from "react";

// hooks
import { usePrevious } from "./usePrevious";
import { useGameStore } from "../store/gameStore";

// services & utils & helpers
import { soundService } from "../services/soundService";

export const useSoundEffects = (): void => {
    const currentPly = useGameStore((s) => s.currentPly);
    const game = useGameStore((s) => s.game);
    const prevPly = usePrevious(currentPly);

    useEffect(() => {
        soundService.preload();
    }, []);

    useEffect(() => {
        if (!game || prevPly === undefined || currentPly === prevPly) return;

        if (currentPly < prevPly) {
            soundService.playMoveBack();
            return;
        }

        const move = game.moves[currentPly];
        if (!move) return;

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
    }, [currentPly, game, prevPly]);
};
