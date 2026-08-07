import { MoveClass } from "../../types";
import { ANNOTATION_CONFIG } from "../../constants/annotations";

interface Props {
    classification: MoveClass;
    compact?: boolean;
}

const MoveAnnotation = ({ classification, compact = false }: Props): JSX.Element | null => {
    const cfg = ANNOTATION_CONFIG[classification];
    if (!cfg) return null;

    const src = `/icons/${classification}.svg`;

    if (compact) {
        return (
            <img
                src={src}
                alt={cfg.label}
                title={cfg.label}
                width={18}
                height={18}
                style={{ display: "inline-block", flexShrink: 0 }}
            />
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5">
            <img src={src} alt={cfg.label} width={20} height={20} style={{ flexShrink: 0 }} />
            <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                {cfg.label}
            </span>
        </span>
    );
};

export default MoveAnnotation;
