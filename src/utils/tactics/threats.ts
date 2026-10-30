// libs
import { Chess, Move } from "chess.js";

// utils
import { directAttackers } from "./attackers";
import {
    BoardPiece,
    PIECE_VALUES,
    RawMove,
    boardWithTurn,
    movesMissingFrom,
    playOnCopy,
    toRawMove,
    valueOf,
} from "./board";
import { getUnsafePieces, isPieceSafe } from "./safety";

// types
import { Color } from "../../types";

// Attacks on `side`'s other unsafe pieces that are worth at least as much as `target`.
const attacksOnBiggerTargets = (
    board: Chess,
    target: BoardPiece,
    side: Color,
    playedMove?: Move
): RawMove[] =>
    getUnsafePieces(board, side, playedMove)
        .filter((piece) => piece.square !== target.square && valueOf(piece) >= valueOf(target))
        .flatMap((piece) => directAttackers(board, piece));

const allowsCheckmate = (board: Chess): boolean => board.moves().some((san) => san.includes("#"));

// Only a queen is worth allowing mate for.
const allowsMateForLess = (board: Chess, target: BoardPiece): boolean =>
    valueOf(target) < PIECE_VALUES.q && allowsCheckmate(board);

// Whether moving `target` with `escape` newly leaves an equal or bigger piece of its side en
// prise, or allows mate.
const escapeExposesMore = (board: Chess, target: BoardPiece, escape: RawMove): boolean => {
    const attacksBefore = attacksOnBiggerTargets(board, target, escape.color);

    const played = playOnCopy(board, escape);
    if (!played) return false;

    const attacksAfter = attacksOnBiggerTargets(played.board, target, escape.color, played.move);
    return (
        movesMissingFrom(attacksAfter, attacksBefore).length > 0 ||
        allowsMateForLess(played.board, target)
    );
};

// Whether, after `capture` takes `target`, the capturing side has an equal or bigger piece of
// its own hanging, or has allowed mate.
const captureBackfires = (board: Chess, target: BoardPiece, capture: RawMove): boolean => {
    const played = playOnCopy(board, capture);
    if (!played) return false;

    return (
        attacksOnBiggerTargets(played.board, target, capture.color).length > 0 ||
        allowsMateForLess(played.board, target)
    );
};

// Whether every way of taking `piece` costs the capturer at least as much as it wins.
export const everyCaptureBackfires = (board: Chess, piece: BoardPiece): boolean =>
    directAttackers(board, piece).every((capture) => captureBackfires(board, piece, capture));

const escapeFails = (board: Chess, piece: BoardPiece, escape: Move): boolean => {
    // Only possible in a turn-flipped position: a piece that can take the king isn't trapped.
    if (escape.captured === "k") return false;

    if (escapeExposesMore(board, piece, toRawMove(escape))) return true;

    const afterEscape = new Chess(board.fen());
    const played = afterEscape.move(escape);
    return !isPieceSafe(afterEscape, { ...piece, square: played.to }, played);
};

// Unsafe where it stands, and every move it can make either still loses it or exposes something
// bigger.
export const isPieceTrapped = (board: Chess, piece: BoardPiece): boolean => {
    const ownTurn = boardWithTurn(board, piece.color);
    if (isPieceSafe(ownTurn, piece)) return false;

    return ownTurn
        .moves({ square: piece.square, verbose: true })
        .every((escape) => escapeFails(ownTurn, piece, escape));
};
