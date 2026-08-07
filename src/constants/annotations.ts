import { MoveClass } from "../types";

export const ANNOTATION_CONFIG: Record<MoveClass, { label: string; color: string } | null> = {
    [MoveClass.Good]: null,
    [MoveClass.Brilliant]: { label: "Brilliant", color: "#1bada6" },
    [MoveClass.Best]: { label: "Best", color: "#96bc4b" },
    [MoveClass.Excellent]: { label: "Excellent", color: "#96bc4b" },
    [MoveClass.Inaccuracy]: { label: "Inaccuracy", color: "#f7c045" },
    [MoveClass.Mistake]: { label: "Mistake", color: "#e58f2a" },
    [MoveClass.Blunder]: { label: "Blunder", color: "#ca3431" },
};
