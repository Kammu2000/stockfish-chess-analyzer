// libs
import { JSX } from "react";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useGameStore } from "../../store/gameStore";

// utils
import { colorFromPly } from "../../utils/ply";

// constants
import { ANNOTATION_CONFIG } from "../../constants/annotations";

// types
import { AnalysisStatus, Color, MoveClass } from "../../types";

const SUMMARY_ORDER: MoveClass[] = [
    MoveClass.Brilliant,
    MoveClass.Critical,
    MoveClass.Best,
    MoveClass.Excellent,
    MoveClass.Good,
    MoveClass.Inaccuracy,
    MoveClass.Mistake,
    MoveClass.Blunder,
];

export const ClassificationSummary = (): JSX.Element | null => {
    const phase = useAnalysisStore((s) => s.phase);
    const game = useGameStore((s) => s.game);
    const goToPly = useGameStore((s) => s.goToPly);

    if (phase.status !== AnalysisStatus.Done) return null;

    const whiteName = game?.headers["White"] ?? "White";
    const blackName = game?.headers["Black"] ?? "Black";

    const movesOf = (color: Color, cls: MoveClass) =>
        phase.results.filter((m) => colorFromPly(m.ply) === color && m.classification === cls);

    const jumpToFirst = (color: Color, cls: MoveClass) => {
        const first = movesOf(color, cls)[0];
        if (!first) return;
        goToPly(first.ply);
        document
            .getElementById(`move-${first.ply}`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    return (
        <div className="rounded-xl bg-surface/80 border border-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Move Breakdown
            </p>
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-muted">
                        <th className="text-right font-normal pb-1 pr-2 w-10">{whiteName}</th>
                        <th className="font-normal pb-1" />
                        <th className="text-left font-normal pb-1 pl-2 w-10">{blackName}</th>
                    </tr>
                </thead>
                <tbody>
                    {SUMMARY_ORDER.map((cls) => {
                        const config = ANNOTATION_CONFIG[cls]!;
                        const whiteCount = movesOf("w", cls).length;
                        const blackCount = movesOf("b", cls).length;
                        if (whiteCount === 0 && blackCount === 0) return null;

                        return (
                            <tr key={cls}>
                                <td className="text-right pr-2 py-0.5">
                                    <button
                                        onClick={() => jumpToFirst("w", cls)}
                                        disabled={whiteCount === 0}
                                        className="tabular-nums font-semibold hover:underline disabled:no-underline disabled:cursor-default"
                                        style={{ color: config.color }}
                                    >
                                        {whiteCount}
                                    </button>
                                </td>
                                <td className="py-0.5 text-center" style={{ color: config.color }}>
                                    {config.label}
                                </td>
                                <td className="text-left pl-2 py-0.5">
                                    <button
                                        onClick={() => jumpToFirst("b", cls)}
                                        disabled={blackCount === 0}
                                        className="tabular-nums font-semibold hover:underline disabled:no-underline disabled:cursor-default"
                                        style={{ color: config.color }}
                                    >
                                        {blackCount}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
