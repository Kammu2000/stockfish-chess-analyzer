// libs
import { create } from "zustand";

// types
import { ParsedGame } from "../types";

export interface GameState {
    game: ParsedGame | null;
    currentPly: number; // index into game.moves; -1 = starting position

    goToPly: (ply: number) => void;
    goToNext: () => void;
    goToPrev: () => void;
    goToStart: () => void;
    goToEnd: () => void;
    reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    game: null,
    currentPly: -1,

    goToPly(ply) {
        const { game } = get();
        if (!game) return;

        const clamped = Math.max(-1, Math.min(ply, game.moves.length - 1));
        set({ currentPly: clamped });
    },

    goToNext() {
        const { game, currentPly } = get();
        if (!game) return;

        if (currentPly < game.moves.length - 1) set({ currentPly: currentPly + 1 });
    },

    goToPrev() {
        const { currentPly } = get();
        if (currentPly >= 0) set({ currentPly: currentPly - 1 });
    },

    goToStart() {
        set({ currentPly: -1 });
    },

    goToEnd() {
        const { game } = get();
        if (!game) return;

        set({ currentPly: game.moves.length - 1 });
    },

    reset() {
        set({ game: null, currentPly: -1 });
    },
}));
