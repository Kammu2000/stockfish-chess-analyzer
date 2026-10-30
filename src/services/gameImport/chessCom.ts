// utils
import { AppError } from "../../utils/errors/appError";
import { isRecord } from "../../utils/utils";

// types
import { GameResult, ImportedGame } from "./types";

const ARCHIVES_URL = (username: string): string =>
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`;

interface ChessComPlayer {
    username: string;
    result: string;
}

interface ChessComGame {
    pgn: string;
    rules: string;
    time_class: string;
    end_time: number;
    white: ChessComPlayer;
    black: ChessComPlayer;
}

const isPlayer = (v: unknown): v is ChessComPlayer =>
    isRecord(v) && typeof v.username === "string" && typeof v.result === "string";

// Games without a PGN (e.g. still in progress) or of an unexpected shape are skipped.
const isGame = (v: unknown): v is ChessComGame =>
    isRecord(v) &&
    typeof v.pgn === "string" &&
    typeof v.rules === "string" &&
    typeof v.time_class === "string" &&
    typeof v.end_time === "number" &&
    isPlayer(v.white) &&
    isPlayer(v.black);

const resultString = (white: ChessComPlayer, black: ChessComPlayer): GameResult => {
    if (white.result === "win") return "1-0";
    if (black.result === "win") return "0-1";
    return "1/2-1/2";
};

const toImportedGame = (game: ChessComGame): ImportedGame => ({
    pgn: game.pgn,
    white: game.white.username,
    black: game.black.username,
    result: resultString(game.white, game.black),
    timeControl: game.time_class,
    isoDate: new Date(game.end_time * 1000).toISOString(),
});

const apiError = (status: number): AppError =>
    new AppError("NetworkError", `Chess.com API error (${status}). Please try again.`);

const unexpectedResponse = (): AppError =>
    new AppError("UnexpectedResponse", "Unexpected response from Chess.com.");

const fetchArchiveUrls = async (username: string): Promise<string[]> => {
    const res = await fetch(ARCHIVES_URL(username));

    if (res.status === 404) {
        throw new AppError("UserNotFound", `No Chess.com account found for "${username}".`);
    }
    if (!res.ok) throw apiError(res.status);

    const data: unknown = await res.json();
    if (!isRecord(data) || !Array.isArray(data.archives)) throw unexpectedResponse();
    return data.archives.filter((url): url is string => typeof url === "string");
};

const fetchArchiveMonth = async (url: string): Promise<ChessComGame[]> => {
    const res = await fetch(url);
    if (!res.ok) throw apiError(res.status);

    const data: unknown = await res.json();
    if (!isRecord(data) || !Array.isArray(data.games)) throw unexpectedResponse();
    return data.games.filter(isGame);
};

export async function fetchChessComGames(
    username: string,
    limit: number = 20
): Promise<ImportedGame[]> {
    const archiveUrls = await fetchArchiveUrls(username);
    const games: ImportedGame[] = [];

    for (let i = archiveUrls.length - 1; i >= 0 && games.length < limit; i--) {
        const monthGames = await fetchArchiveMonth(archiveUrls[i]);

        const standardGames = monthGames
            .filter((g) => g.rules === "chess")
            .map(toImportedGame)
            .reverse(); // newest first within the month

        games.push(...standardGames);
    }

    return games.slice(0, limit);
}
