// constants
import { ANNOTATION_CONFIG } from "../../constants/annotations";

// types
import { MoveClass } from "../../types";

interface Props {
    classification: MoveClass;
    compact?: boolean;
}

export const MoveAnnotation = ({ classification, compact = false }: Props): JSX.Element | null => {
    const annotationConfig = ANNOTATION_CONFIG[classification];
    if (!annotationConfig) return null;

    const src = `/icons/${classification}.svg`;

    if (compact) {
        return (
            <img
                src={src}
                alt={annotationConfig.label}
                title={annotationConfig.label}
                width={18}
                height={18}
                style={{ display: "inline-block", flexShrink: 0 }}
            />
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5">
            <img
                src={src}
                alt={annotationConfig.label}
                width={20}
                height={20}
                style={{ flexShrink: 0 }}
            />
            <span className="text-xs font-semibold" style={{ color: annotationConfig.color }}>
                {annotationConfig.label}
            </span>
        </span>
    );
};
