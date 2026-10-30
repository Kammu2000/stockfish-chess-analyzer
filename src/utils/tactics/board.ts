// libs
import { Chess, Move, PieceSymbol, Square } from "chess.js";

// types
import { Color } from "../../types";

export interface BoardPiece {
    type: PieceSymbol;
    color: Color;
    square: Square;
}

// A move reduced to the fields that identify it, so moves from different boards can be compared.
export interface RawMove {
    piece: PieceSymbol;
    color: Color;
    from: Square;
    to: Square;
    promotion?: PieceSymbol;
}

export const PIECE_VALUES: Record<PieceSymbol, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: Infinity,
};

export const valueOf = (piece: { type: PieceSymbol }): number => PIECE_VALUES[piece.type];

export const opponent = (color: Color): Color => (color === "w" ? "b" : "w");

export const toRawMove = (move: Move): RawMove => ({
    piece: move.piece,
    color: move.color as Color,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
});

export const movingPiece = (move: RawMove): BoardPiece => ({
    type: move.piece,
    color: move.color,
    square: move.from,
});

export const isSameMove = (a: RawMove, b: RawMove): boolean =>
    a.piece === b.piece &&
    a.color === b.color &&
    a.from === b.from &&
    a.to === b.to &&
    a.promotion === b.promotion;

// Moves in `a` that aren't in `b`.
export const movesMissingFrom = (a: RawMove[], b: RawMove[]): RawMove[] =>
    a.filter((move) => !b.some((other) => isSameMove(move, other)));

// A copy of the position with `color` to move, so we can ask "what could this side do here?".
// Changing whose turn it is invalidates any en passant square.
export const boardWithTurn = (board: Chess, color: Color): Chess => {
    const fields = board.fen().split(" ");
    if (fields[1] !== color) fields[3] = "-";
    fields[1] = color;
    return new Chess(fields.join(" "));
};

// Plays a move on a copy of the board; undefined if the move is illegal there.
export const playOnCopy = (
    board: Chess,
    move: RawMove | Move
): { board: Chess; move: Move } | undefined => {
    const copy = new Chess(board.fen());
    try {
        return { board: copy, move: copy.move(move) };
    } catch {
        return undefined;
    }
};

export const getCaptureSquare = (move: Move): Square =>
    move.isEnPassant() ? (`${move.to[0]}${move.from[1]}` as Square) : move.to;

export const piecesOf = (board: Chess, color: Color): BoardPiece[] =>
    board
        .board()
        .flat()
        .filter((p): p is NonNullable<typeof p> => p !== null && p.color === color)
        .map((p) => ({ type: p.type, color: p.color as Color, square: p.square }));
