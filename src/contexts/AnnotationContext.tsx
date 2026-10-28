// libs
import { createContext, CSSProperties, useContext } from "react";

// types
import { MoveClass } from "../types";

interface AnnotationCtx {
    destSquare: string | null;
    classification: MoveClass | null;
    // react-chessboard ignores its own `squareStyles` once a custom squareRenderer is used, so
    // AnnotatedSquare applies them (move-selection highlights, legal-move dots).
    squareStyles: Record<string, CSSProperties>;
}

const defaultValue: AnnotationCtx = {
    destSquare: null,
    classification: null,
    squareStyles: {},
};

export const AnnotationContext = createContext<AnnotationCtx>(defaultValue);

export const useAnnotation = () => useContext(AnnotationContext);
