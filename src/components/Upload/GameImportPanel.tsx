// libs
import { JSX, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// hooks
import { usePersistentState } from "../../hooks/usePersistentState";

// services
import {
    fetchChessComGames,
    fetchLichessGames,
    GameImportError,
    ImportedGame,
    ImportSource,
} from "../../services/gameImport";

// constants
import { STORAGE_KEYS } from "../../constants/storage";

interface GameImportPanelProps {
    source: ImportSource;
    disabled: boolean;
    onSelectGame: (pgn: string) => void;
}

const PLATFORM_LABEL: Record<ImportSource, string> = {
    chesscom: "Chess.com",
    lichess: "Lichess",
};

const fetchGames = (source: ImportSource, username: string): Promise<ImportedGame[]> =>
    source === "chesscom" ? fetchChessComGames(username) : fetchLichessGames(username);

const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

export const GameImportPanel = ({
    source,
    disabled,
    onSelectGame,
}: GameImportPanelProps): JSX.Element => {
    // Remembered per platform (the panel is keyed by source, so it remounts on tab switch).
    const [username, setUsername] = usePersistentState(
        STORAGE_KEYS.importUsername(source),
        "",
        (v): v is string => typeof v === "string"
    );
    const [searchedUsername, setSearchedUsername] = useState<string | null>(null);

    const {
        data: games,
        error,
        isFetching,
    } = useQuery({
        queryKey: ["gameImport", source, searchedUsername],
        queryFn: () => fetchGames(source, searchedUsername!),
        enabled: searchedUsername !== null,
        staleTime: 5 * 60 * 1000, // cache a username's results for 5 minutes
        // Don't retry "account not found" errors — only retry transient/network ones.
        retry: (failureCount, err) =>
            !(err instanceof GameImportError && err.notFound) && failureCount < 2,
    });

    const handleSearch = (): void => {
        const trimmed = username.trim();
        if (!trimmed) return;
        setSearchedUsername(trimmed);
    };

    const errorMessage = error
        ? error instanceof GameImportError
            ? error.message
            : `Could not reach ${PLATFORM_LABEL[source]}. Please try again.`
        : games && games.length === 0
          ? `No recent games found for "${searchedUsername}" on ${PLATFORM_LABEL[source]}.`
          : null;

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder={`${PLATFORM_LABEL[source]} username`}
                    disabled={disabled || isFetching}
                    className="flex-1 min-w-0 rounded-lg bg-surface border border-panel px-3 py-2 text-xs text-white placeholder-muted/50 focus:outline-none focus:border-accent disabled:opacity-50"
                />
                <button
                    onClick={handleSearch}
                    disabled={disabled || isFetching || !username.trim()}
                    className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {isFetching ? "Searching…" : "Search"}
                </button>
            </div>

            {errorMessage && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
                    {errorMessage}
                </p>
            )}

            {games && games.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {games.map((game, i) => (
                        <button
                            key={i}
                            onClick={() => onSelectGame(game.pgn)}
                            disabled={disabled}
                            className="w-full text-left rounded-lg bg-surface border border-panel px-3 py-2 text-xs text-white hover:border-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate">
                                    {game.white} vs {game.black}
                                </span>
                                <span className="text-muted shrink-0">{game.result}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5 text-muted">
                                <span className="capitalize">{game.timeControl}</span>
                                <span>{formatDate(game.date)}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
