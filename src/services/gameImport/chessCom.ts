// types
import { ImportedGame, GameImportError } from "./types";

const ARCHIVES_URL = (username: string): string =>
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`;

interface ChessComPlayer {
    username: string;
    result: string;
}

interface ChessComGame {
    pgn?: string;
    rules: string;
    time_class: string;
    end_time: number;
    white: ChessComPlayer;
    black: ChessComPlayer;
}

const resultString = (white: ChessComPlayer, black: ChessComPlayer): string => {
    if (white.result === "win") return "1-0";
    if (black.result === "win") return "0-1";
    return "1/2-1/2";
};

const toImportedGame = (game: ChessComGame): ImportedGame => ({
    pgn: game.pgn ?? "",
    white: game.white.username,
    black: game.black.username,
    result: resultString(game.white, game.black),
    timeControl: game.time_class,
    date: new Date(game.end_time * 1000).toISOString(),
});

const fetchArchiveUrls = async (username: string): Promise<string[]> => {
    const res = await fetch(ARCHIVES_URL(username));

    if (res.status === 404) {
        throw new GameImportError(`No Chess.com account found for "${username}".`, true);
    }
    if (!res.ok) {
        throw new GameImportError(`Chess.com API error (${res.status}). Please try again.`);
    }

    const data = await res.json();
    return (data.archives as string[] | undefined) ?? [];
};

const fetchArchiveMonth = async (url: string): Promise<ChessComGame[]> => {
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.games as ChessComGame[] | undefined) ?? [];
};

/**
 * Fetches a user's most recent standard-chess games from Chess.com, walking
 * monthly archives (newest first) until `limit` games are collected.
 */
export async function fetchChessComGames(
    username: string,
    limit: number = 20
): Promise<ImportedGame[]> {
    const archiveUrls = await fetchArchiveUrls(username);
    const games: ImportedGame[] = [];

    for (let i = archiveUrls.length - 1; i >= 0 && games.length < limit; i--) {
        const monthGames = await fetchArchiveMonth(archiveUrls[i]);

        const standardGames = monthGames
            .filter((g) => g.rules === "chess" && typeof g.pgn === "string")
            .map(toImportedGame)
            .reverse(); // newest first within the month

        games.push(...standardGames);
    }

    return games.slice(0, limit);
}
