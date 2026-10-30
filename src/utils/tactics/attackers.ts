// libs
import { Chess } from "chess.js";

// utils
import {
    BoardPiece,
    RawMove,
    boardWithTurn,
    getCaptureSquare,
    movesMissingFrom,
    opponent,
    playOnCopy,
    toRawMove,
} from "./board";

// Enemy moves that capture `piece` right now. Only legal captures count (a pinned piece can't
// take), a capture-promotion counts once, and an enemy king touching the square counts even if
// taking would be illegal — it still guards the square.
export const directAttackers = (board: Chess, piece: BoardPiece): RawMove[] => {
    const attackerColor = opponent(piece.color);
    const attackerBoard = boardWithTurn(board, attackerColor);

    const captures = attackerBoard
        .moves({ verbose: true })
        .filter(
            (move) =>
                getCaptureSquare(move) === piece.square &&
                (!move.promotion || move.promotion === "q")
        )
        .map(toRawMove);

    if (captures.some((move) => move.piece === "k")) return captures;

    const guardingKing = attackerBoard
        .attackers(piece.square, attackerColor)
        .find((square) => attackerBoard.get(square)?.type === "k");
    if (!guardingKing) return captures;

    return [
        ...captures,
        { piece: "k", color: attackerColor, from: guardingKing, to: piece.square },
    ];
};

// Lifts `front` off the board and returns the attackers on `piece` that this changes — normally
// the ones lined up behind it — along with the board without it.
const attackersBehind = (
    board: Chess,
    piece: BoardPiece,
    front: RawMove
): { revealed: RawMove[]; boardWithoutFront: Chess } => {
    const withFront = directAttackers(board, piece).filter((move) => move.from !== front.from);

    const boardWithoutFront = new Chess(board.fen());
    boardWithoutFront.remove(front.from);
    const withoutFront = directAttackers(boardWithoutFront, piece);

    return {
        revealed: [
            ...movesMissingFrom(withFront, withoutFront),
            ...movesMissingFrom(withoutFront, withFront),
        ],
        boardWithoutFront,
    };
};

// Direct attackers plus every piece queued up behind them (batteries and X-rays of any depth),
// which joins in once the pieces in front have captured and moved off the line.
export const allAttackers = (board: Chess, piece: BoardPiece): RawMove[] => {
    const attackers = directAttackers(board, piece);

    // Attackers still to look behind, each with the board on which it is the front attacker.
    const toExpand = attackers.map((attacker) => ({ attacker, board }));

    while (toExpand.length > 0) {
        const { attacker, board: frontBoard } = toExpand.pop()!;
        if (attacker.piece === "k") continue; // a king is never the front of a battery

        const { revealed, boardWithoutFront } = attackersBehind(frontBoard, piece, attacker);
        attackers.push(...revealed);
        toExpand.push(...revealed.map((move) => ({ attacker: move, board: boardWithoutFront })));
    }

    return attackers;
};

// Pieces that can take back after `capture` lands on its target square, or undefined if the
// capture is illegal (e.g. a king taking a defended piece).
const recapturesAfter = (board: Chess, capture: RawMove): RawMove[] | undefined => {
    const played = playOnCopy(boardWithTurn(board, capture.color), capture);
    if (!played) return undefined;

    return allAttackers(played.board, {
        type: capture.piece,
        color: capture.color,
        square: capture.to,
    });
};

// With no capture to play out, pretend the piece belongs to the enemy: whatever of its own side
// could then capture it is what guards it.
const guardsOfSquare = (board: Chess, piece: BoardPiece): RawMove[] => {
    const asEnemyPiece: BoardPiece = { ...piece, color: opponent(piece.color) };
    const swapped = new Chess(board.fen());
    swapped.put({ type: asEnemyPiece.type, color: asEnemyPiece.color }, piece.square);
    return allAttackers(swapped, asEnemyPiece);
};

// The moves that would win `piece`'s square back: after each possible capture, the recaptures
// available, keeping the fewest (the attacker picks the capture that's hardest to answer).
export const defenders = (board: Chess, piece: BoardPiece): RawMove[] => {
    let fewest: RawMove[] | undefined;

    for (const capture of directAttackers(board, piece)) {
        const recaptures = recapturesAfter(board, capture);
        if (recaptures && (!fewest || recaptures.length < fewest.length)) fewest = recaptures;
    }

    return fewest ?? guardsOfSquare(board, piece);
};
