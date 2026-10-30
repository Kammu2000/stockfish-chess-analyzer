// libs
import { JSX, useMemo } from "react";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useGameStore } from "../../store/gameStore";

// utils
import { scoreToWhitePercent } from "../../utils/score";

// types
import { AnalysisStatus } from "../../types";

const WIDTH = 100;
const HEIGHT = 36;

export const EvaluationGraph = (): JSX.Element | null => {
    const phase = useAnalysisStore((s) => s.phase);
    const currentPly = useGameStore((s) => s.currentPly);
    const goToPly = useGameStore((s) => s.goToPly);

    const points = useMemo(() => {
        if (phase.status !== AnalysisStatus.Done || phase.results.length === 0) return null;

        const whitePercents = [
            scoreToWhitePercent(phase.results[0].scoreBefore),
            ...phase.results.map((m) => scoreToWhitePercent(m.scoreAfter)),
        ];

        return whitePercents.map((whitePercent, i) => ({
            ply: i - 1,
            x: (i / (whitePercents.length - 1)) * WIDTH,
            y: HEIGHT - (whitePercent / 100) * HEIGHT,
        }));
    }, [phase]);

    if (!points) return null;

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area = `${path} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
    const activePoint = points.find((p) => p.ply === currentPly) ?? points[0];
    const segmentWidth = WIDTH / (points.length - 1 || 1);

    return (
        <div className="rounded-xl bg-surface/80 border border-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Evaluation
            </p>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                className="w-full h-16"
            >
                <line
                    x1={0}
                    y1={HEIGHT / 2}
                    x2={WIDTH}
                    y2={HEIGHT / 2}
                    stroke="currentColor"
                    className="text-panel"
                    strokeWidth={0.5}
                />
                <path d={area} fill="#f0f0f0" fillOpacity={0.15} stroke="none" />
                <path d={path} fill="none" stroke="#f0f0f0" strokeWidth={1} />
                <circle cx={activePoint.x} cy={activePoint.y} r={1.5} fill="#1baca6" />
                <line
                    x1={activePoint.x}
                    y1={0}
                    x2={activePoint.x}
                    y2={HEIGHT}
                    stroke="#1baca6"
                    strokeWidth={0.4}
                    strokeDasharray="1.5,1.5"
                />
                {points.map((p) => (
                    <rect
                        key={p.ply}
                        x={p.x - segmentWidth / 2}
                        y={0}
                        width={segmentWidth}
                        height={HEIGHT}
                        fill="transparent"
                        onClick={() => goToPly(p.ply)}
                        className="cursor-pointer"
                    />
                ))}
            </svg>
        </div>
    );
};
