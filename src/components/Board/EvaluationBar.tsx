// constants
import { MAX_CP } from "../../constants/board";

interface EvaluationBarProps {
    scoreCP: number;
    scoreMate?: number;
    orientation?: "white" | "black";
}

const cpToPercent = (cp: number): number => {
    const clamped = Math.max(-MAX_CP, Math.min(MAX_CP, cp));
    return 50 + (clamped / MAX_CP) * 50;
};

const formatScore = (cp: number, mate?: number): string => {
    if (mate !== undefined) return `M${Math.abs(mate)}`;
    const pawns = Math.abs(cp) / 100;
    return (cp >= 0 ? "+" : "-") + pawns.toFixed(1);
};

const EvaluationBar = ({
    scoreCP,
    scoreMate,
    orientation = "white",
}: EvaluationBarProps): JSX.Element => {
    let whitePercent = scoreMate !== undefined ? (scoreMate > 0 ? 100 : 0) : cpToPercent(scoreCP);

    if (orientation === "black") whitePercent = 100 - whitePercent;

    const label = formatScore(scoreCP, scoreMate);
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

export default EvaluationBar;
