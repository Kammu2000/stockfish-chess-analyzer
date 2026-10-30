// libs
import { Chess, Move } from "chess.js";
import { describe, expect, it } from "vitest";

// utils
import { buildClassifiedMoves } from "./classifyMoves";
import { computeAccuracy } from "./accuracy";
import { GAMES, loadGame } from "../../test/famousGames";

// types
import { PositionEval, Score } from "../../types";

// Regression net: classifies real games with deterministic fake evals. If a change is meant to
// alter these results, review the snapshot diff and update it with `npx vitest run -u`.

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// FNV-1a: a stable pseudo-random number per position, so "engine" evals are reproducible.
const hash = (text: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h >>> 0;
};

const materialBalance = (board: Chess): number =>
    board
        .board()
        .flat()
        .reduce((sum, p) => sum + (p ? (p.color === "w" ? 1 : -1) * PIECE_VALUES[p.type] : 0), 0);

const fakeEval = (fen: string, nextMove: Move | undefined): PositionEval => {
    const h = hash(fen);
    const board = new Chess(fen);
    const balance = materialBalance(board);
    const score: Score =
        h % 7 === 0
            ? { kind: "mate", mate: (h % 2 ? 1 : -1) * ((h % 9) + 1) }
            : { kind: "cp", cp: balance * 100 + (h % 601) - 300 };

    const toMove = board.turn() === "w" ? 1 : -1;
    const runnerUpLoss = (h >>> 8) % 500;
    const secondScore: Score | undefined =
        h % 5 === 0 || score.kind === "mate"
            ? undefined
            : { kind: "cp", cp: score.cp - toMove * runnerUpLoss };

    const bestMove =
        nextMove && (h >>> 4) % 2 === 0
            ? nextMove.from + nextMove.to + (nextMove.promotion ?? "")
            : "a1a2";
    return { score, secondScore, bestMove, pv: [] };
};

describe.each(Object.entries(GAMES))("%s", (_name, pgn) => {
    const { moves, history } = loadGame(pgn);

    it("classifies every move the same way", () => {
        const evals = [
            ...history.map((m) => fakeEval(m.before, m)),
            fakeEval(history[history.length - 1].after, undefined),
        ];
        const classified = buildClassifiedMoves(moves, evals);
        const lines = classified.map((m) => `${m.ply} ${m.san} ${m.classification}`);
        lines.push(
            `accuracy w ${computeAccuracy(classified, "w")} b ${computeAccuracy(classified, "b")}`
        );
        expect(lines).toMatchSnapshot();
    });
});
