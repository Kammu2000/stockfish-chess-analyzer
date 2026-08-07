// libs
import { memo } from "react";

// hooks
import { useGameStore } from "../../store/gameStore";

const btnCls = (disabled: boolean) =>
    `w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
        disabled
            ? "text-muted/30 cursor-not-allowed"
            : "text-white hover:bg-surface/80 hover:text-accent"
    }`;

export const ControlButtons = memo((): JSX.Element => {
    const currentPly = useGameStore((s) => s.currentPly);
    const game = useGameStore((s) => s.game);
    const goToStart = useGameStore((s) => s.goToStart);
    const goToPrev = useGameStore((s) => s.goToPrev);
    const goToNext = useGameStore((s) => s.goToNext);
    const goToEnd = useGameStore((s) => s.goToEnd);

    const atStart = currentPly < 0;
    const atEnd = !game || currentPly === game.moves.length - 1;
    const hasGame = !!game;

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={goToStart}
                disabled={!hasGame || atStart}
                className={btnCls(!hasGame || atStart)}
                title="First move"
            >
                ⏮
            </button>
            <button
                onClick={goToPrev}
                disabled={!hasGame || atStart}
                className={btnCls(!hasGame || atStart)}
                title="Previous"
            >
                ◀
            </button>
            <button
                onClick={goToNext}
                disabled={!hasGame || atEnd}
                className={btnCls(!hasGame || atEnd)}
                title="Next"
            >
                ▶
            </button>
            <button
                onClick={goToEnd}
                disabled={!hasGame || atEnd}
                className={btnCls(!hasGame || atEnd)}
                title="Last move"
            >
                ⏭
            </button>
        </div>
    );
});
