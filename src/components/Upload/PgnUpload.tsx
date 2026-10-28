// libs
import { DragEvent, JSX, useCallback, useRef, useState } from "react";

// components
import { DepthSelect } from "./DepthSelect";
import { GameImportPanel } from "./GameImportPanel";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";
import { usePersistentState } from "../../hooks/usePersistentState";

// constants
import { STORAGE_KEYS } from "../../constants/storage";

// types
import { AnalysisStatus } from "../../types";
import { ImportSource } from "../../services/gameImport";

type UploadTab = "manual" | ImportSource;

const isUploadTab = (v: unknown): v is UploadTab =>
    v === "manual" || v === "chesscom" || v === "lichess";

const TABS: { key: UploadTab; label: string }[] = [
    { key: "manual", label: "Upload / Paste" },
    { key: "chesscom", label: "Chess.com" },
    { key: "lichess", label: "Lichess" },
];

export const PgnUpload = (): JSX.Element => {
    const [tab, setTab] = usePersistentState<UploadTab>(
        STORAGE_KEYS.uploadTab,
        "manual",
        isUploadTab
    );
    const [dragOver, setDragOver] = useState(false);
    const [pgnText, setPgnText] = usePersistentState(
        STORAGE_KEYS.pgnInput,
        "",
        (v): v is string => typeof v === "string"
    );
    const [error, setError] = useState<string | null>(null);

    const phase = useAnalysisStore((s) => s.phase);
    const startAnalysis = useAnalysisStore((s) => s.startAnalysis);

    const fileRef = useRef<HTMLInputElement>(null);

    const handlePGN = useCallback(
        async (pgn: string) => {
            const trimmed = pgn.trim();
            if (!trimmed) return;

            setError(null);

            try {
                await startAnalysis(trimmed);
            } catch (e) {
                setError("Invalid PGN — please check the file format.");
            }
        },
        [startAnalysis, setError]
    );

    const onFileUpload = useCallback(
        (file: File) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (!e.target) return;
                const text = e.target.result as string;
                // Mirror the file into the textarea so it's remembered like a pasted game.
                setPgnText(text);
                handlePGN(text);
            };
            reader.readAsText(file);
        },
        [handlePGN, setPgnText]
    );

    const onDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            setDragOver(false);

            const file = e.dataTransfer.files[0];
            if (file) onFileUpload(file);
        },
        [setDragOver, onFileUpload]
    );

    const isAnalyzing = phase.status === AnalysisStatus.Analyzing;

    return (
        <div className="space-y-4">
            <div className="flex gap-1 rounded-lg bg-surface/60 border border-panel p-1">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={[
                            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                            tab === key ? "bg-accent text-white" : "text-muted hover:text-white",
                        ].join(" ")}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === "manual" && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    className={[
                        "rounded-lg border transition-colors",
                        dragOver ? "border-accent bg-accent/10" : "border-panel",
                    ].join(" ")}
                >
                    <textarea
                        value={pgnText}
                        onChange={(e) => setPgnText(e.target.value)}
                        placeholder="Paste PGN here, or drop a .pgn file…"
                        rows={3}
                        disabled={isAnalyzing}
                        className="w-full rounded-t-lg bg-surface px-3 py-2 text-xs text-white font-mono placeholder-muted/50 resize-none focus:outline-none disabled:opacity-50"
                    />
                    <div className="flex gap-2 p-2 pt-0">
                        <button
                            onClick={() => !isAnalyzing && fileRef.current?.click()}
                            disabled={isAnalyzing}
                            className="rounded-md bg-surface border border-panel px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:border-muted/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Upload file…
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pgn,text/plain"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onFileUpload(f);
                            }}
                        />
                        <button
                            onClick={() => handlePGN(pgnText)}
                            disabled={isAnalyzing || !pgnText.trim()}
                            className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isAnalyzing ? "Analyzing…" : "Analyze Game"}
                        </button>
                    </div>
                </div>
            )}

            {(tab === "chesscom" || tab === "lichess") && (
                <GameImportPanel
                    key={tab}
                    source={tab}
                    disabled={isAnalyzing}
                    onSelectGame={handlePGN}
                />
            )}

            <DepthSelect disabled={isAnalyzing} />

            {error && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>
            )}
        </div>
    );
};
