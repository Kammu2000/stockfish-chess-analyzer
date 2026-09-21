import { Chess, PieceSymbol, Square } from "chess.js";

import { Color } from "../types";

// Algorithm: docs/move-classification.md

export interface BoardPiece {
    type: PieceSymbol;
    color: Color;
    square: Square;
}

export const PIECE_VALUES: Record<PieceSymbol, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: Infinity,
};

const opponent = (color: Color): Color => (color === "w" ? "b" : "w");

export const getBoardPieces = (board: Chess): BoardPiece[] =>
    board
        .board()
        .flat()
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => ({ type: p.type, color: p.color as Color, square: p.square }));

// Attackers of `square` by `color`, including revealed X-ray/battery attackers behind the direct
// ones — found by iteratively removing the front attacker and recomputing attackers() on the
// reduced board.
export const attackingSquares = (
    board: Chess,
    square: Square,
    color: Color,
    transitive = true
): Square[] => {
    const direct = board.attackers(square, color);
    if (!transitive) return direct;

    const seen = new Set(direct);
    const frontier = [...direct];

    while (frontier.length > 0) {
        const attackerSquare = frontier.pop()!;
        const piece = board.get(attackerSquare);
        if (!piece || piece.type === "k") continue; // a king can't back a battery

        const reduced = new Chess(board.fen());
        reduced.remove(attackerSquare);

        for (const revealed of reduced.attackers(square, color)) {
            if (seen.has(revealed) || revealed === attackerSquare) continue;
            seen.add(revealed);
            frontier.push(revealed);
        }
    }

    return [...seen];
};

// Recapture squares available if the opponent captures `piece`, assuming they pick the attacker
// leaving fewest recaptures. If nothing attacks it yet, checks how contested the square would be.
export const defendingSquares = (board: Chess, piece: BoardPiece, transitive = true): Square[] => {
    const attackerColor = opponent(piece.color);
    const directAttackers = attackingSquares(board, piece.square, attackerColor, false);

    if (directAttackers.length === 0) {
        const hypothetical = new Chess(board.fen());
        hypothetical.remove(piece.square);
        hypothetical.put({ type: piece.type, color: attackerColor }, piece.square);
        return attackingSquares(hypothetical, piece.square, piece.color, transitive);
    }

    let fewestRecaptures: Square[] | null = null;

    for (const attackerSquare of directAttackers) {
        const attacker = board.get(attackerSquare);
        if (!attacker) continue;

        const captureBoard = new Chess(board.fen());
        captureBoard.remove(piece.square);
        captureBoard.remove(attackerSquare);
        captureBoard.put({ type: attacker.type, color: attacker.color }, piece.square);

        const recaptures = attackingSquares(captureBoard, piece.square, piece.color, transitive);
        if (!fewestRecaptures || recaptures.length < fewestRecaptures.length) {
            fewestRecaptures = recaptures;
        }
    }

    return fewestRecaptures ?? [];
};

// Safe if the opponent can't win material taking it: no lower-value attacker, enough defenders,
// or a favorable/breakeven recapture chain.
export const isPieceSafe = (board: Chess, piece: BoardPiece): boolean => {
    const attackerColor = opponent(piece.color);
    const directAttackers = attackingSquares(board, piece.square, attackerColor, false).map(
        (sq) => board.get(sq)!
    );

    if (
        directAttackers.some((attacker) => PIECE_VALUES[attacker.type] < PIECE_VALUES[piece.type])
    ) {
        return false;
    }

    const attackers = attackingSquares(board, piece.square, attackerColor);
    const defenders = defendingSquares(board, piece);

    if (attackers.length <= defenders.length) return true;

    const lowestValueAttacker = directAttackers.reduce((min, a) =>
        PIECE_VALUES[a.type] < PIECE_VALUES[min.type] ? a : min
    );

    // Cheaper than every attacker, with a defender cheap enough that the attacker gains nothing.
    if (
        PIECE_VALUES[piece.type] < PIECE_VALUES[lowestValueAttacker.type] &&
        defenders.some(
            (sq) => PIECE_VALUES[board.get(sq)!.type] < PIECE_VALUES[lowestValueAttacker.type]
        )
    ) {
        return true;
    }

    return defenders.some((sq) => board.get(sq)!.type === "p");
};

export const getUnsafePieces = (board: Chess, color: Color): BoardPiece[] =>
    getBoardPieces(board).filter(
        (piece) =>
            piece.color === color &&
            piece.type !== "p" &&
            piece.type !== "k" &&
            !isPieceSafe(board, piece)
    );

// Trapped if unsafe where it stands and every reachable square is also unsafe — no escape.
export const isPieceTrapped = (board: Chess, piece: BoardPiece): boolean => {
    if (isPieceSafe(board, piece)) return false;

    const calibrated = new Chess(board.fen().replace(/ (w|b) /, ` ${piece.color} `));
    const escapeSquares = calibrated
        .moves({ square: piece.square, verbose: true })
        .map((move) => move.to);

    if (escapeSquares.length === 0) return true;

    return escapeSquares.every((to) => {
        const escapeBoard = new Chess(calibrated.fen());
        escapeBoard.remove(piece.square);
        const captured = escapeBoard.get(to);
        escapeBoard.put({ type: piece.type, color: piece.color }, to);

        // Capturing the opponent's king isn't a real move.
        if (captured?.type === "k") return false;

        return !isPieceSafe(escapeBoard, { ...piece, square: to });
    });
};
