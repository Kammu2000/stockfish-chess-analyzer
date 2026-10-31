// libs
import { JSX, ReactNode, useEffect } from "react";

// components
import { DepthSelect } from "../Upload/DepthSelect";
import { EngineVariantSelect } from "./EngineVariantSelect";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { useSettingsStore } from "../../store/settingsStore";

// types
import { AnalysisStatus } from "../../types";

interface SettingsDialogProps {
    onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: ReactNode }): JSX.Element => (
    <section className="flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
        {children}
    </section>
);

interface ToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const Toggle = ({ label, description, checked, onChange }: ToggleProps): JSX.Element => (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="flex flex-col">
            <span className="text-sm text-white">{label}</span>
            <span className="text-xs text-muted">{description}</span>
        </span>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
                checked ? "bg-accent" : "bg-panel"
            }`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    checked ? "translate-x-5" : ""
                }`}
            />
        </button>
    </label>
);

export const SettingsDialog = ({ onClose }: SettingsDialogProps): JSX.Element => {
    const isAnalyzing = useAnalysisStore((s) => s.phase.status === AnalysisStatus.Analyzing);
    const hasResults = useAnalysisStore((s) => s.phase.status === AnalysisStatus.Done);
    const showBestMoveArrow = useSettingsStore((s) => s.showBestMoveArrow);
    const setShowBestMoveArrow = useSettingsStore((s) => s.setShowBestMoveArrow);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                className="w-full max-w-sm rounded-xl border border-panel bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-panel/60 px-5 py-3">
                    <h2 id="settings-title" className="text-sm font-semibold">
                        Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted hover:text-white transition-colors text-lg leading-none"
                        title="Close (Esc)"
                        aria-label="Close settings"
                    >
                        ×
                    </button>
                </div>

                <div className="flex flex-col gap-6 px-5 py-4">
                    <Section title="Engine">
                        <EngineVariantSelect disabled={isAnalyzing} />
                        <DepthSelect disabled={isAnalyzing} />
                        {(isAnalyzing || hasResults) && (
                            <p className="text-xs text-muted text-right">
                                Applies to the next analysis.
                            </p>
                        )}
                    </Section>

                    <Section title="Board">
                        <Toggle
                            label="Suggestion arrows"
                            description="Show the engine's best move as an arrow"
                            checked={showBestMoveArrow}
                            onChange={setShowBestMoveArrow}
                        />
                    </Section>
                </div>
            </div>
        </div>
    );
};
