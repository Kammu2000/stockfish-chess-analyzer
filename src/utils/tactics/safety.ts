// libs
import { Chess, Move } from "chess.js";

// utils
import { allAttackers, defenders as defendingMoves, directAttackers } from "./attackers";
import { BoardPiece, PIECE_VALUES, movingPiece, piecesOf, valueOf } from "./board";

// types
import { Color } from "../../types";

const cheapest = (pieces: BoardPiece[]): number => Math.min(...pieces.map(valueOf));

// A rook that just took a minor piece and can only be taken back by a minor piece is a favourable
// exchange (rook for two minors), not a hanging rook.
const isRookForTwoMinors = (
    piece: BoardPiece,
    playedMove: Move | undefined,
    attackers: BoardPiece[],
    defenders: BoardPiece[]
): boolean =>
    piece.type === "r" &&
    playedMove?.captured !== undefined &&
    PIECE_VALUES[playedMove.captured] === PIECE_VALUES.n &&
    attackers.length === 1 &&
    valueOf(attackers[0]) === PIECE_VALUES.n &&
    defenders.length > 0;

// Safe if no capture wins the attacker material. `playedMove` is the move that just put the piece
// here, if any.
export const isPieceSafe = (board: Chess, piece: BoardPiece, playedMove?: Move): boolean => {
    const direct = directAttackers(board, piece).map(movingPiece);
    const attackers = allAttackers(board, piece).map(movingPiece);
    const defenders = defendingMoves(board, piece).map(movingPiece);

    if (isRookForTwoMinors(piece, playedMove, attackers, defenders)) return true;

    // A cheaper piece can take it: profitable even if it gets recaptured.
    if (direct.some((attacker) => valueOf(attacker) < valueOf(piece))) return false;

    // Every capture can be answered with a recapture (also covers "not attacked at all").
    if (attackers.length <= defenders.length) return true;

    // Outnumbered, but every attacker is worth more than the piece and a defender cheaper than
    // the attacker recaptures, so taking it loses the attacker material.
    const cheapestAttacker = cheapest(direct);
    if (
        valueOf(piece) < cheapestAttacker &&
        defenders.some((defender) => valueOf(defender) < cheapestAttacker)
    ) {
        return true;
    }

    // A pawn recapture means the attacker at best trades evenly.
    return defenders.some((defender) => defender.type === "p");
};

// `color`'s pieces (excluding pawns and the king) that can be won. Pieces worth no more than what
// `playedMove` just captured are a trade, not a hanging piece.
export const getUnsafePieces = (board: Chess, color: Color, playedMove?: Move): BoardPiece[] => {
    const capturedValue = playedMove?.captured ? PIECE_VALUES[playedMove.captured] : 0;

    return piecesOf(board, color).filter(
        (piece) =>
            piece.type !== "p" &&
            piece.type !== "k" &&
            valueOf(piece) > capturedValue &&
            !isPieceSafe(board, piece, playedMove)
    );
};
