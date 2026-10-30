// utils
import { isRecord } from "../../utils/utils";

// types
import { GameResult, ImportedGame, GameImportError } from "./types";

const GAMES_URL = (username: string, limit: number): string =>
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${limit}&pgnInJson=true`;

interface LichessPlayer {
    user?: { name: string };
    aiLevel?: number;
}

interface LichessGame {
    pgn: string;
    variant: string;
    speed: string;
    lastMoveAt: number;
    players: { white: LichessPlayer; black: LichessPlayer };
    winner?: "white" | "black";
}

const isPlayer = (v: unknown): v is LichessPlayer =>
    isRecord(v) &&
    (v.user === undefined || (isRecord(v.user) && typeof v.user.name === "string")) &&
    (v.aiLevel === undefined || typeof v.aiLevel === "number");

// Games without a PGN or of an unexpected shape are skipped.
const isGame = (v: unknown): v is LichessGame =>
    isRecord(v) &&
    typeof v.pgn === "string" &&
    typeof v.variant === "string" &&
    typeof v.speed === "string" &&
    typeof v.lastMoveAt === "number" &&
    isRecord(v.players) &&
    isPlayer(v.players.white) &&
    isPlayer(v.players.black) &&
    (v.winner === undefined || v.winner === "white" || v.winner === "black");

const parseLine = (line: string): unknown => {
    try {
        return JSON.parse(line);
    } catch {
        throw new GameImportError("Unexpected response from Lichess.");
    }
};

const playerName = (player: LichessPlayer): string =>
    player.user?.name ?? (player.aiLevel ? `AI Level ${player.aiLevel}` : "Unknown");

const resultString = (game: LichessGame): GameResult => {
    if (game.winner === "white") return "1-0";
    if (game.winner === "black") return "0-1";
    return "1/2-1/2";
};

const toImportedGame = (game: LichessGame): ImportedGame => ({
    pgn: game.pgn,
    white: playerName(game.players.white),
    black: playerName(game.players.black),
    result: resultString(game),
    timeControl: game.speed,
    isoDate: new Date(game.lastMoveAt).toISOString(),
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

    return text
        .split("\n")
        .filter((line) => line.length > 0)
        .map(parseLine)
        .filter(isGame)
        .filter((g) => g.variant === "standard")
        .map(toImportedGame);
}
