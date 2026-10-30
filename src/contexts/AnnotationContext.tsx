// libs
import { createContext, CSSProperties, useContext } from "react";

// types
import { MoveClass } from "../types";

interface AnnotationCtx {
    destSquare: string | null;
    classification: MoveClass | null;
    squareStyles: Record<string, CSSProperties>;
}

const defaultValue: AnnotationCtx = {
    destSquare: null,
    classification: null,
    squareStyles: {},
};

export const AnnotationContext = createContext<AnnotationCtx>(defaultValue);

export const useAnnotation = () => useContext(AnnotationContext);
