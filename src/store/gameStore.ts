// libs
import { create } from "zustand";
import { persist } from "zustand/middleware";

// constants
import { STORAGE_KEYS, STORAGE_PREFIX } from "../constants/storage";

// utils
import { anchorPly, mainRef, subtreeIds, Variations } from "../utils/variations";

// types
import { MoveNode, ParsedGame, PositionRef, VariationNode } from "../types";

export interface GameState {
    game: ParsedGame | null;
    // Main-line ply on display (-1 = start). Inside a variation this is the main-line ply the
    // variation branches from, so main-line-only views (graph, summary) keep a sensible anchor.
    currentPly: number;
    currentVarId: string | null; // non-null = a user variation move is on display
    variations: Variations;
    flipped: boolean; // true = Black at the bottom; kept across games as a viewing preference

    loadGame: (game: ParsedGame) => void;
    goToPly: (ply: number) => void;
    goToVariation: (id: string) => void;
    goToNext: () => void;
    goToPrev: () => void;
    goToStart: () => void;
    goToEnd: () => void;
    addVariation: (parent: PositionRef, move: MoveNode) => string;
    updateVariation: (id: string, patch: Partial<VariationNode>) => void;
    deleteVariation: (id: string) => void;
    toggleFlipped: () => void;
    reset: () => void;
}

let nextVariationId = 0;

export const currentRef = (s: Pick<GameState, "currentPly" | "currentVarId">): PositionRef =>
    s.currentVarId ? { kind: "var", id: s.currentVarId } : mainRef(s.currentPly);

export const useGameStore = create<GameState>()(
    persist(
        (set, get) => ({
            game: null,
            currentPly: -1,
            currentVarId: null,
            variations: {},
            flipped: false,

            loadGame(game) {
                set({ game, currentPly: -1, currentVarId: null, variations: {} });
            },

            goToPly(ply) {
                const { game } = get();
                if (!game) return;

                const clamped = Math.max(-1, Math.min(ply, game.moves.length - 1));
                set({ currentPly: clamped, currentVarId: null });
            },

            goToVariation(id) {
                const { variations } = get();
                if (!variations[id]) return;
                set({ currentVarId: id, currentPly: anchorPly(variations, id) });
            },

            goToNext() {
                const { game, currentPly, currentVarId, variations } = get();
                if (!game) return;

                if (currentVarId) {
                    const next = variations[currentVarId]?.children[0];
                    if (next) set({ currentVarId: next });
                } else if (currentPly < game.moves.length - 1) {
                    set({ currentPly: currentPly + 1 });
                }
            },

            goToPrev() {
                const { currentPly, currentVarId, variations } = get();

                if (currentVarId) {
                    const parent = variations[currentVarId]?.parent;
                    if (parent?.kind === "var") set({ currentVarId: parent.id });
                    else set({ currentVarId: null, currentPly: parent?.ply ?? -1 });
                } else if (currentPly >= 0) {
                    set({ currentPly: currentPly - 1 });
                }
            },

            goToStart() {
                set({ currentPly: -1, currentVarId: null });
            },

            // Inside a variation: end of the current line; on the main line: last move.
            goToEnd() {
                const { game, currentVarId, variations } = get();
                if (!game) return;

                if (currentVarId) {
                    let id = currentVarId;
                    while (variations[id]?.children[0]) id = variations[id].children[0];
                    set({ currentVarId: id });
                } else {
                    set({ currentPly: game.moves.length - 1 });
                }
            },

            addVariation(parent, move) {
                const id = `v${++nextVariationId}`;
                const node: VariationNode = { id, parent, move, children: [], status: "pending" };
                const variations = { ...get().variations, [id]: node };

                if (parent.kind === "var") {
                    const p = variations[parent.id];
                    variations[parent.id] = { ...p, children: [...p.children, id] };
                }

                set({ variations, currentVarId: id, currentPly: anchorPly(variations, id) });
                return id;
            },

            updateVariation(id, patch) {
                const { variations } = get();
                if (!variations[id]) return; // deleted, or a new game was loaded meanwhile
                set({ variations: { ...variations, [id]: { ...variations[id], ...patch } } });
            },

            // Removes the node and everything after it; moves the cursor out if it was inside.
            deleteVariation(id) {
                const { variations, currentVarId } = get();
                const node = variations[id];
                if (!node) return;

                const removed = new Set(subtreeIds(variations, id));
                const next: Variations = {};
                for (const [key, v] of Object.entries(variations)) {
                    if (!removed.has(key)) next[key] = v;
                }
                if (node.parent.kind === "var" && next[node.parent.id]) {
                    const p = next[node.parent.id];
                    next[node.parent.id] = { ...p, children: p.children.filter((c) => c !== id) };
                }

                if (currentVarId && removed.has(currentVarId)) {
                    const parent = node.parent;
                    set({
                        variations: next,
                        currentVarId: parent.kind === "var" ? parent.id : null,
                        currentPly: parent.kind === "var" ? anchorPly(next, parent.id) : parent.ply,
                    });
                } else {
                    set({ variations: next });
                }
            },

            toggleFlipped() {
                set({ flipped: !get().flipped });
            },

            reset() {
                set({ game: null, currentPly: -1, currentVarId: null, variations: {} });
            },
        }),
        {
            name: STORAGE_PREFIX + STORAGE_KEYS.boardSettings,
            version: 1,
            partialize: (s) => ({ flipped: s.flipped }),
            merge: (persisted, current) => {
                const flipped = (persisted as Partial<GameState> | undefined)?.flipped;
                return typeof flipped === "boolean" ? { ...current, flipped } : current;
            },
        }
    )
);
