// libs
import { forwardRef, memo, useCallback } from "react";

// components
import { MoveAnnotation } from "./MoveAnnotation";

// hooks
import { useGameStore } from "../../store/gameStore";

// types
import { MoveClass } from "../../types";

export interface MoveCellProps {
    san: string;
    ply: number;
    active: boolean;
    classification?: MoveClass;
}

export const MoveCell = memo(
    forwardRef<HTMLButtonElement, MoveCellProps>(
        ({ san, ply, active, classification }, ref): JSX.Element => {
            const goToPly = useGameStore((s) => s.goToPly);

            const handleClick = useCallback(() => {
                goToPly(ply);
            }, [ply, goToPly]);

            return (
                <button
                    ref={ref}
                    onClick={handleClick}
                    className={[
                        "flex items-center gap-1 px-2 py-0.5 rounded text-left w-full transition-colors",
                        active ? "bg-accent/20 text-white" : "text-gray-300 hover:bg-surface",
                    ].join(" ")}
                >
                    <span className="font-medium">{san}</span>
                    {classification && classification !== MoveClass.Good && (
                        <MoveAnnotation classification={classification} compact />
                    )}
                </button>
            );
        }
    )
);
