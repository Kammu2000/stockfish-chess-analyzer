// constants
import { START_FEN } from "../constants/board";

// types
import { ClassifiedMove, MoveNode, ParsedGame, PositionRef, VariationNode } from "../types";

export type Variations = Record<string, VariationNode>;

export const mainRef = (ply: number): PositionRef => ({ kind: "main", ply });

export const isSameRef = (a: PositionRef, b: PositionRef): boolean =>
    a.kind === "main" ? b.kind === "main" && a.ply === b.ply : b.kind === "var" && a.id === b.id;

// Main-line ply a variation ultimately branches from (the position *before* its first move).
export const anchorPly = (variations: Variations, id: string): number => {
    let node = variations[id];
    while (node && node.parent.kind === "var") node = variations[node.parent.id];
    return node && node.parent.kind === "main" ? node.parent.ply : -1;
};

// The move that led to `ref` (null at the start position).
export const moveAt = (
    game: ParsedGame | null,
    variations: Variations,
    ref: PositionRef
): MoveNode | null =>
    ref.kind === "var" ? (variations[ref.id]?.move ?? null) : (game?.moves[ref.ply] ?? null);

export const fenAt = (game: ParsedGame | null, variations: Variations, ref: PositionRef): string =>
    moveAt(game, variations, ref)?.fen ?? game?.moves[0]?.fenBefore ?? START_FEN;

export const parentOf = (variations: Variations, ref: PositionRef): PositionRef | null => {
    if (ref.kind === "var") return variations[ref.id]?.parent ?? null;
    return ref.ply >= 0 ? mainRef(ref.ply - 1) : null;
};

// Variation roots branching from main-line position `ply`, in creation order.
export const mainBranches = (variations: Variations, ply: number): VariationNode[] =>
    Object.values(variations).filter((v) => v.parent.kind === "main" && v.parent.ply === ply);

// Child variation ids hanging off `ref` (for main-line positions: the roots branching there).
export const childVariationIds = (variations: Variations, ref: PositionRef): string[] =>
    ref.kind === "var"
        ? (variations[ref.id]?.children ?? [])
        : mainBranches(variations, ref.ply).map((v) => v.id);

export const subtreeIds = (variations: Variations, id: string): string[] => {
    const node = variations[id];
    if (!node) return [];
    return [id, ...node.children.flatMap((c) => subtreeIds(variations, c))];
};

// Nearest book opening at or before `ref`, walking back through variations to the main line.
export const nearestOpening = (
    variations: Variations,
    results: ClassifiedMove[],
    ref: PositionRef
): ClassifiedMove["opening"] => {
    let cur: PositionRef = ref;
    while (cur.kind === "var") {
        const node: VariationNode | undefined = variations[cur.id];
        if (!node) return undefined;
        if (node.result?.opening) return node.result.opening;
        cur = node.parent;
    }
    for (let i = cur.ply; i >= 0; i--) if (results[i]?.opening) return results[i].opening;
    return undefined;
};
