// libs
import { JSX, useEffect } from "react";
import { defaultPieces } from "react-chessboard";

interface PromotionPickerProps {
    color: "w" | "b";
    onChoose: (piece: "q" | "r" | "b" | "n") => void;
    onCancel: () => void;
}

const CHOICES = [
    { piece: "q", label: "Queen" },
    { piece: "r", label: "Rook" },
    { piece: "b", label: "Bishop" },
    { piece: "n", label: "Knight" },
] as const;

// Overlay on top of the board for choosing the promotion piece (Esc / backdrop click cancels).
export const PromotionPicker = ({
    color,
    onChoose,
    onCancel,
}: PromotionPickerProps): JSX.Element => {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onCancel]);

    return (
        <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 rounded"
            onClick={onCancel}
        >
            <div
                className="flex gap-2 rounded-xl border border-panel bg-surface p-3 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Choose promotion piece"
            >
                {CHOICES.map(({ piece, label }) => (
                    <button
                        key={piece}
                        onClick={() => onChoose(piece)}
                        title={label}
                        aria-label={`Promote to ${label}`}
                        className="w-16 h-16 rounded-lg bg-[#d9e6f0] hover:bg-accent/70 transition-colors p-1"
                    >
                        {defaultPieces[`${color}${piece.toUpperCase()}`]()}
                    </button>
                ))}
            </div>
        </div>
    );
};
