// libs
import { JSX } from "react";

// utils
import { formatScore, scoreToWhitePercent } from "../../utils/score";

// types
import { Score } from "../../types";

interface EvaluationBarProps {
    score: Score;
    orientation?: "white" | "black";
}

export const EvaluationBar = ({
    score,
    orientation = "white",
}: EvaluationBarProps): JSX.Element => {
    let whitePercent = scoreToWhitePercent(score);

    if (orientation === "black") whitePercent = 100 - whitePercent;

    const label = formatScore(score);
    const whiteOnTop = orientation === "black";

    return (
        <div className="relative flex flex-col w-5 h-full rounded-sm overflow-hidden bg-[#1c1c1c] select-none">
            <div
                className="transition-all duration-300 ease-out bg-[#f0f0f0]"
                style={{ height: whiteOnTop ? `${whitePercent}%` : `${100 - whitePercent}%` }}
            />
            <div
                className="absolute left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-0.5 rounded"
                style={{
                    top: whitePercent > 50 ? "4px" : undefined,
                    bottom: whitePercent <= 50 ? "4px" : undefined,
                    color: whitePercent > 50 ? "#1c1c1c" : "#f0f0f0",
                }}
            >
                {label}
            </div>
        </div>
    );
};
