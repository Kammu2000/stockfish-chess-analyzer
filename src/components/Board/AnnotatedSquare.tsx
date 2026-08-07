// libs
import { FC, Ref } from "react";

// hooks
import { useAnnotation } from "../../contexts/AnnotationContext";

// types
import { MoveClass } from "../../types";
import { CustomSquareProps } from "react-chessboard/dist/chessboard/types";

// react-chessboard expects FC<CustomSquareProps>; ref is a plain prop (React 19 style), not forwardRef.
const AnnotatedSquare: FC<CustomSquareProps> = ({ square, style, children, ref }): JSX.Element => {
    const { destSquare, classification } = useAnnotation();
    const showBadge =
        square === destSquare && classification != null && classification !== MoveClass.Good;

    return (
        <div ref={ref as Ref<HTMLDivElement>} style={{ ...style, position: "relative" }}>
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

export default AnnotatedSquare;
