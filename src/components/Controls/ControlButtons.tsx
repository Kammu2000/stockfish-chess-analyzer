// libs
import { JSX, memo } from "react";

// hooks
import { useGameStore } from "../../store/gameStore";

const IconSkipStart = (): JSX.Element => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <rect x="5" y="5" width="2.5" height="14" rx="1" />
        <path d="M19 5.5v13a1 1 0 0 1-1.53.85L8 13.5a1 1 0 0 1 0-1.7l9.47-5.85A1 1 0 0 1 19 6.65Z" />
    </svg>
);

const IconStepBack = (): JSX.Element => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M16 5.5v13a1 1 0 0 1-1.53.85L6 13.5a1 1 0 0 1 0-1.7l8.47-5.85A1 1 0 0 1 16 6.65Z" />
    </svg>
);

const IconStepForward = (): JSX.Element => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M8 5.5v13a1 1 0 0 0 1.53.85L18 13.5a1 1 0 0 0 0-1.7L9.53 5.95A1 1 0 0 0 8 6.65Z" />
    </svg>
);

const IconSkipEnd = (): JSX.Element => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M5 5.5v13a1 1 0 0 0 1.53.85L16 13.5a1 1 0 0 0 0-1.7L6.53 5.95A1 1 0 0 0 5 6.65Z" />
        <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
    </svg>
);

export const IconFlip = (): JSX.Element => (
    <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5" />
        <path d="M17 20V4m0 16-3.5-3.5M17 20l3.5-3.5" />
    </svg>
);

const skipBtnCls = (disabled: boolean) =>
    [
        "flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-150",
        disabled
            ? "border-transparent text-muted/25 cursor-not-allowed"
            : "border-panel text-muted hover:text-white hover:border-accent/60 hover:bg-surface active:scale-90",
    ].join(" ");

const stepBtnCls = (disabled: boolean) =>
    [
        "flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-150",
        disabled
            ? "border-transparent text-muted/25 cursor-not-allowed"
            : "border-accent/50 text-white hover:bg-accent hover:border-accent active:scale-90",
    ].join(" ");

export const ControlButtons = memo((): JSX.Element => {
    const currentPly = useGameStore((s) => s.currentPly);
    const currentVarId = useGameStore((s) => s.currentVarId);
    const hasNextInVariation = useGameStore((s) =>
        s.currentVarId ? (s.variations[s.currentVarId]?.children.length ?? 0) > 0 : false
    );
    const game = useGameStore((s) => s.game);
    const goToStart = useGameStore((s) => s.goToStart);
    const goToPrev = useGameStore((s) => s.goToPrev);
    const goToNext = useGameStore((s) => s.goToNext);
    const goToEnd = useGameStore((s) => s.goToEnd);

    const atStart = !currentVarId && currentPly < 0;
    const atEnd = currentVarId
        ? !hasNextInVariation
        : !game || currentPly === game.moves.length - 1;
    const hasGame = !!game;

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={goToStart}
                disabled={!hasGame || atStart}
                className={skipBtnCls(!hasGame || atStart)}
                title="First move"
            >
                <IconSkipStart />
            </button>
            <button
                onClick={goToPrev}
                disabled={!hasGame || atStart}
                className={stepBtnCls(!hasGame || atStart)}
                title="Previous"
            >
                <IconStepBack />
            </button>
            <button
                onClick={goToNext}
                disabled={!hasGame || atEnd}
                className={stepBtnCls(!hasGame || atEnd)}
                title="Next"
            >
                <IconStepForward />
            </button>
            <button
                onClick={goToEnd}
                disabled={!hasGame || atEnd}
                className={skipBtnCls(!hasGame || atEnd)}
                title="Last move"
            >
                <IconSkipEnd />
            </button>
        </div>
    );
});
