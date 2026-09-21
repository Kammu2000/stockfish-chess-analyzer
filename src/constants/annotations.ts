import { MoveClass } from "../types";

export const ANNOTATION_CONFIG: Record<MoveClass, { label: string; color: string } | null> = {
    [MoveClass.Brilliant]: { label: "Brilliant", color: "#1baca6" },
    [MoveClass.Critical]: { label: "Great Move", color: "#5c8bb0" },
    [MoveClass.Best]: { label: "Best", color: "#96bc4b" },
    [MoveClass.Excellent]: { label: "Excellent", color: "#96bc4b" },
    [MoveClass.Good]: null,
    [MoveClass.Forced]: { label: "Forced", color: "#97af8b" },
    [MoveClass.Inaccuracy]: { label: "Inaccuracy", color: "#f7c045" },
    [MoveClass.Mistake]: { label: "Mistake", color: "#e58f2a" },
    [MoveClass.Blunder]: { label: "Blunder", color: "#ca3431" },
};
