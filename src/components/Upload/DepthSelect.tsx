// libs
import { JSX } from "react";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";

// constants
import { DEPTH_OPTIONS } from "../../constants/analysis";

interface DepthSelectProps {
    disabled: boolean;
}

export const DepthSelect = ({ disabled }: DepthSelectProps): JSX.Element => {
    const depth = useAnalysisStore((s) => s.depth);
    const setDepth = useAnalysisStore((s) => s.setDepth);

    return (
        <label className="flex items-center justify-end gap-2 text-xs text-muted">
            <span title="Higher depth = stronger, slower analysis">Engine depth</span>
            <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                disabled={disabled}
                className="bg-panel border border-panel/80 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-accent disabled:opacity-50"
            >
                {DEPTH_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                        {d}
                    </option>
                ))}
            </select>
        </label>
    );
};
