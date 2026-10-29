// hooks
import { useAnalysisStore } from "../store/analysisStore";
import { currentRef, useGameStore } from "../store/gameStore";

// utils
import { fenAt, moveAt, parentOf, Variations } from "../utils/variations";

// types
import {
    AnalysisPhase,
    AnalysisStatus,
    ClassifiedMove,
    MoveNode,
    PositionRef,
    Score,
    VariationNode,
} from "../types";

export interface CurrentPosition {
    ref: PositionRef;
    fen: string;
    move: MoveNode | null; // move that led here (null at the start)
    result: ClassifiedMove | null;
    variation: VariationNode | null; // set when a user variation move is on display
    score: Score | null; // best-known evaluation of this position
}

const resultAt = (
    phase: AnalysisPhase,
    variations: Variations,
    ref: PositionRef
): ClassifiedMove | null => {
    if (ref.kind === "var") return variations[ref.id]?.result ?? null;
    return phase.status === AnalysisStatus.Done && ref.ply >= 0
        ? (phase.results[ref.ply] ?? null)
        : null;
};

// Falls back to the parent's score while a variation move is still being evaluated.
const scoreAt = (phase: AnalysisPhase, variations: Variations, ref: PositionRef): Score | null => {
    if (phase.status !== AnalysisStatus.Done) return null;
    let cur: PositionRef | null = ref;
    while (cur) {
        if (cur.kind === "main") return phase.positionEvals[cur.ply + 1]?.score ?? null;
        const score = variations[cur.id]?.evalAfter?.score;
        if (score) return score;
        cur = parentOf(variations, cur);
    }
    return null;
};

export const useCurrentPosition = (): CurrentPosition => {
    const game = useGameStore((s) => s.game);
    const currentPly = useGameStore((s) => s.currentPly);
    const currentVarId = useGameStore((s) => s.currentVarId);
    const variations = useGameStore((s) => s.variations);
    const phase = useAnalysisStore((s) => s.phase);

    const ref = currentRef({ currentPly, currentVarId });

    return {
        ref,
        fen: fenAt(game, variations, ref),
        move: moveAt(game, variations, ref),
        result: resultAt(phase, variations, ref),
        variation: currentVarId ? (variations[currentVarId] ?? null) : null,
        score: scoreAt(phase, variations, ref),
    };
};
