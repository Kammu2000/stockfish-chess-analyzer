// libs
import { createContext, useContext } from "react";

// types
import { MoveClass } from "../types";

interface AnnotationCtx {
    destSquare: string | null;
    classification: MoveClass | null;
}

const defaultValue: AnnotationCtx = {
    destSquare: null,
    classification: null,
};

export const AnnotationContext = createContext<AnnotationCtx>(defaultValue);

export const useAnnotation = () => useContext(AnnotationContext);
