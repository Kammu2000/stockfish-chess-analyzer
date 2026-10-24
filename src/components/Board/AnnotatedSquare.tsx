// libs
import { JSX } from "react";
import { SquareRenderer } from "react-chessboard";

// hooks
import { useAnnotation } from "../../contexts/AnnotationContext";

export const AnnotatedSquare: SquareRenderer = ({ square, children }): JSX.Element => {
    const { destSquare, classification } = useAnnotation();
    const showBadge = square === destSquare && classification != null;

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {children}
            {showBadge && (
                <img
                    src={`/icons/${classification}.svg`}
                    alt={classification}
                    style={{
                        position: "absolute",
                        top: "-12%",
                        right: "-12%",
                        width: "40%",
                        height: "40%",
                        zIndex: 20,
                        pointerEvents: "none",
                        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
                    }}
                />
            )}
        </div>
    );
};
