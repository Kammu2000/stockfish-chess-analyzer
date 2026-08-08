// libs
import { DragEvent, useCallback, useRef, useState } from "react";

// hooks
import { useAnalysisStore } from "../../store/analysisStore";

export const PgnUpload = (): JSX.Element => {
    const [dragOver, setDragOver] = useState(false);
    const [pgnText, setPgnText] = useState("");
    const [error, setError] = useState<string | null>(null);

    const status = useAnalysisStore((s) => s.status);
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
            reader.onload = (e) => e.target && handlePGN(e.target.result as string);
            reader.readAsText(file);
        },
        [handlePGN]
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

    const isAnalyzing = status === "analyzing";

    return (
        <div className="space-y-4">
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !isAnalyzing && fileRef.current?.click()}
                className={[
                    "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200",
                    dragOver
                        ? "border-accent bg-accent/10 scale-[1.01]"
                        : "border-panel hover:border-muted/50",
                    isAnalyzing ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
            >
                <div className="text-4xl">♟</div>
                <div className="text-center">
                    <p className="text-sm font-medium text-white">Drop a PGN file here</p>
                    <p className="text-xs text-muted mt-1">or click to browse</p>
                </div>
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
            </div>

            <div className="space-y-2">
                <label className="text-xs text-muted uppercase tracking-wider">Or paste PGN</label>
                <textarea
                    value={pgnText}
                    onChange={(e) => setPgnText(e.target.value)}
                    placeholder='[Event "My Game"]&#10;1. e4 e5 2. Nf3 Nc6 ...'
                    rows={5}
                    disabled={isAnalyzing}
                    className="w-full rounded-lg bg-surface border border-panel px-3 py-2 text-xs text-white font-mono placeholder-muted/50 resize-none focus:outline-none focus:border-accent disabled:opacity-50"
                />
                <button
                    onClick={() => handlePGN(pgnText)}
                    disabled={isAnalyzing || !pgnText.trim()}
                    className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {isAnalyzing ? "Analyzing…" : "Analyze Game"}
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>
            )}
        </div>
    );
};
