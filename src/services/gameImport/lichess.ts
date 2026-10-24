// types
import { ImportedGame, GameImportError } from "./types";

const GAMES_URL = (username: string, limit: number): string =>
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${limit}&pgnInJson=true`;

interface LichessPlayer {
    user?: { name: string };
    aiLevel?: number;
}

interface LichessGame {
    pgn?: string;
    variant: string;
    speed: string;
    lastMoveAt: number;
    players: { white: LichessPlayer; black: LichessPlayer };
    winner?: "white" | "black";
}

const playerName = (player: LichessPlayer): string =>
    player.user?.name ?? (player.aiLevel ? `AI Level ${player.aiLevel}` : "Unknown");

const resultString = (game: LichessGame): string => {
    if (game.winner === "white") return "1-0";
    if (game.winner === "black") return "0-1";
    return "1/2-1/2";
};

const toImportedGame = (game: LichessGame): ImportedGame => ({
    pgn: game.pgn ?? "",
    white: playerName(game.players.white),
    black: playerName(game.players.black),
    result: resultString(game),
    timeControl: game.speed,
    date: new Date(game.lastMoveAt).toISOString(),
});

export async function fetchLichessGames(
    username: string,
    limit: number = 20
): Promise<ImportedGame[]> {
    const res = await fetch(GAMES_URL(username, limit), {
        headers: { Accept: "application/x-ndjson" },
    });

    if (res.status === 404) {
        throw new GameImportError(`No Lichess account found for "${username}".`, true);
    }
    if (!res.ok) {
        throw new GameImportError(`Lichess API error (${res.status}). Please try again.`);
    }

    const text = await res.text();

    const games: LichessGame[] = text
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));

    return games
        .filter((g) => g.variant === "standard" && typeof g.pgn === "string")
        .map(toImportedGame);
}
