// libs
import { JSX } from "react";

// hooks
import { useSettingsStore } from "../../store/settingsStore";

// services
import { EngineVariant } from "../../services/engineService";

interface EngineVariantSelectProps {
    disabled: boolean;
}

const OPTIONS: { value: EngineVariant; label: string; description: string }[] = [
    { value: "lite", label: "Lite", description: "~5MB download, faster to load" },
    { value: "rich", label: "Full strength", description: "~93MB download, strongest analysis" },
];

export const EngineVariantSelect = ({ disabled }: EngineVariantSelectProps): JSX.Element => {
    const engineVariant = useSettingsStore((s) => s.engineVariant);
    const setEngineVariant = useSettingsStore((s) => s.setEngineVariant);

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm text-white">Engine strength</span>
            <div className="flex gap-1 rounded-lg bg-surface/60 border border-panel p-1">
                {OPTIONS.map(({ value, label }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setEngineVariant(value)}
                        disabled={disabled}
                        className={[
                            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            engineVariant === value
                                ? "bg-accent text-white"
                                : "text-muted hover:text-white",
                        ].join(" ")}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <span className="text-xs text-muted">
                {OPTIONS.find((o) => o.value === engineVariant)?.description}
            </span>
        </div>
    );
};
