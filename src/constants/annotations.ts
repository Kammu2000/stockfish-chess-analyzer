// types
import { MoveClass } from "../types";

export const ANNOTATION_CONFIG: Record<MoveClass, { label: string; color: string } | null> = {
    [MoveClass.Brilliant]: { label: "Brilliant", color: "#1baca6" },
    [MoveClass.Critical]: { label: "Critical", color: "#5c8bb0" },
    [MoveClass.Best]: { label: "Best", color: "#96bc4b" },
    [MoveClass.Excellent]: { label: "Excellent", color: "#96bc4b" },
    [MoveClass.Good]: { label: "Good", color: "#96af8b" },
    [MoveClass.Forced]: { label: "Forced", color: "#97af8b" },
    [MoveClass.Theory]: { label: "Book", color: "#a88865" },
    [MoveClass.Inaccuracy]: { label: "Inaccuracy", color: "#f7c045" },
    [MoveClass.Mistake]: { label: "Mistake", color: "#e58f2a" },
    [MoveClass.Blunder]: { label: "Blunder", color: "#ca3431" },
};

export const CLASSIFICATION_PHRASE: Record<MoveClass, string> = {
    [MoveClass.Brilliant]: "is brilliant",
    [MoveClass.Critical]: "is critical",
    [MoveClass.Best]: "is best",
    [MoveClass.Excellent]: "is excellent",
    [MoveClass.Good]: "is good",
    [MoveClass.Forced]: "is forced",
    [MoveClass.Theory]: "is a book move",
    [MoveClass.Inaccuracy]: "is an inaccuracy",
    [MoveClass.Mistake]: "is a mistake",
    [MoveClass.Blunder]: "is a blunder",
};
