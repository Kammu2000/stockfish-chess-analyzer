// libs
import { JSX } from "react";

// components
import { AccuracyCard } from "../Analysis/AccuracyCard";
import { ClassificationSummary } from "../Analysis/ClassificationSummary";
import { EvaluationGraph } from "../Analysis/EvaluationGraph";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useGameStore } from "../../store/gameStore";
import { useUiStore } from "../../store/uiStore";

// types
import { AnalysisStatus, ClassifiedMove, Opening, ParsedGame } from "../../types";

const deepestOpening = (
    results: ClassifiedMove[],
    headers: ParsedGame["headers"] = {}
): Partial<Opening> => {
    const fromBook = [...results].reverse().find((m) => m.opening)?.opening;
    return fromBook ?? { name: headers["Opening"], eco: headers["ECO"] };
};

const SkeletonCard = ({ height }: { height: string }) => (
    <div className={`rounded-xl bg-surface/60 border border-panel animate-pulse ${height}`} />
);

export const ReportTab = (): JSX.Element | null => {
    const phase = useAnalysisStore((s) => s.phase);
    const game = useGameStore((s) => s.game);
    const goToPly = useGameStore((s) => s.goToPly);
    const setActiveTab = useUiStore((s) => s.setActiveTab);

    if (phase.status === AnalysisStatus.Analyzing) {
        return (
            <div className="space-y-3">
                <SkeletonCard height="h-28" />
                <SkeletonCard height="h-24" />
                <SkeletonCard height="h-48" />
            </div>
        );
    }

    if (phase.status !== AnalysisStatus.Done) return null;

    const { name: openingName, eco: openingEco } = deepestOpening(phase.results, game?.headers);

    const startReview = (): void => {
        goToPly(0);
        setActiveTab("analysis");
    };

    return (
        <div className="space-y-3">
            {openingName && (
                <div className="rounded-xl bg-surface/80 border border-panel px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                        Opening
                    </p>
                    <p className="text-sm text-white">
                        {openingEco && (
                            <span className="font-mono text-white/60 mr-1.5">{openingEco}</span>
                        )}
                        {openingName}
                    </p>
                </div>
            )}
            <EvaluationGraph />
            <AccuracyCard />
            <ClassificationSummary />
            <button
                onClick={startReview}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80"
            >
                Start review →
            </button>
        </div>
    );
};
