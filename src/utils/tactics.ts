// libs
import { Chess, Move, PieceSymbol, Square } from "chess.js";

// types
import { Color } from "../types";

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

const opponent = (color: Color): Color => (color === "w" ? "b" : "w");

const toRawMove = (move: Move): RawMove => ({
    piece: move.piece,
    color: move.color as Color,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
});

const toBoardPiece = (move: RawMove): BoardPiece => ({
    type: move.piece,
    color: move.color,
    square: move.from,
});

const isSameRawMove = (a: RawMove, b: RawMove): boolean =>
    a.piece === b.piece &&
    a.color === b.color &&
    a.from === b.from &&
    a.to === b.to &&
    a.promotion === b.promotion;

// Changing whose turn it is invalidates any en passant square.
export const setFenTurn = (fen: string, color: Color): string => {
    const parts = fen.split(" ");
    if (parts[1] !== color) parts[3] = "-";
    parts[1] = color;
    return parts.join(" ");
};

export const getCaptureSquare = (move: Move): Square =>
    move.isEnPassant() ? (`${move.to[0]}${move.from[1]}` as Square) : move.to;

export const getBoardPieces = (board: Chess): BoardPiece[] =>
    board
        .board()
        .flat()
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => ({ type: p.type, color: p.color as Color, square: p.square }));

// Legal captures of `piece` (pinned pieces excluded), plus a king that attacks the square even if
// capturing would be illegal — a king still "covers" a square for safety purposes.
const directAttackingMoves = (board: Chess, piece: BoardPiece): RawMove[] => {
    const attackerColor = opponent(piece.color);
    const attackerBoard = new Chess(setFenTurn(board.fen(), attackerColor));

    const attackingMoves = attackerBoard
        .moves({ verbose: true })
        // A capture-promotion is one attacker, not one per promotion piece.
        .filter(
            (move) =>
                getCaptureSquare(move) === piece.square &&
                (!move.promotion || move.promotion === "q")
        )
        .map(toRawMove);

    const kingSquare = attackerBoard
        .attackers(piece.square, attackerColor)
        .find((square) => attackerBoard.get(square)?.type === "k");

    if (kingSquare && !attackingMoves.some((move) => move.piece === "k")) {
        attackingMoves.push({
            piece: "k",
            color: attackerColor,
            from: kingSquare,
            to: piece.square,
        });
    }

    return attackingMoves;
};

export const getAttackingMoves = (
    board: Chess,
    piece: BoardPiece,
    transitive = true
): RawMove[] => {
    const attackingMoves = directAttackingMoves(board, piece);
    if (!transitive) return attackingMoves;

    // Each battery member, with the board on which it is the front (direct) attacker.
    const frontier = attackingMoves.map((move) => ({
        directFen: board.fen(),
        square: move.from,
        type: move.piece,
    }));

    while (frontier.length > 0) {
        const attacker = frontier.pop()!;
        if (attacker.type === "k") continue; // a king can't be at the front of a battery

        const transitiveBoard = new Chess(attacker.directFen);
        const oldAttackingMoves = directAttackingMoves(transitiveBoard, piece).filter(
            (move) => move.from !== attacker.square
        );

        transitiveBoard.remove(attacker.square);
        const newAttackingMoves = directAttackingMoves(transitiveBoard, piece);

        const revealed = [
            ...oldAttackingMoves.filter((a) => !newAttackingMoves.some((b) => isSameRawMove(a, b))),
            ...newAttackingMoves.filter((a) => !oldAttackingMoves.some((b) => isSameRawMove(a, b))),
        ];

        attackingMoves.push(...revealed);
        frontier.push(
            ...revealed.map((move) => ({
                directFen: transitiveBoard.fen(),
                square: move.from,
                type: move.piece,
            }))
        );
    }

    return attackingMoves;
};

export const getDefendingMoves = (
    board: Chess,
    piece: BoardPiece,
    transitive = true
): RawMove[] => {
    const attackingMoves = getAttackingMoves(board, piece, false);

    let smallestRecapturerSet: RawMove[] | undefined;

    for (const attackingMove of attackingMoves) {
        const captureBoard = new Chess(setFenTurn(board.fen(), opponent(piece.color)));
        try {
            captureBoard.move(attackingMove);
        } catch {
            continue; // e.g. a king capturing onto a defended square
        }

        const recapturers = getAttackingMoves(
            captureBoard,
            { type: attackingMove.piece, color: attackingMove.color, square: attackingMove.to },
            transitive
        );

        if (!smallestRecapturerSet || recapturers.length < smallestRecapturerSet.length) {
            smallestRecapturerSet = recapturers;
        }
    }

    if (smallestRecapturerSet) return smallestRecapturerSet;

    const flippedPiece: BoardPiece = { ...piece, color: opponent(piece.color) };
    const defenderBoard = new Chess(board.fen());
    defenderBoard.put({ type: flippedPiece.type, color: flippedPiece.color }, piece.square);
    return getAttackingMoves(defenderBoard, flippedPiece, transitive);
};

// Safe if no attacker can win material: a lower-value defender always makes the trade bad for
// the attacker, and a pawn defender makes it break-even at worst.
export const isPieceSafe = (board: Chess, piece: BoardPiece, playedMove?: Move): boolean => {
    const directAttackers = getAttackingMoves(board, piece, false).map(toBoardPiece);
    const attackers = getAttackingMoves(board, piece).map(toBoardPiece);
    const defenders = getDefendingMoves(board, piece).map(toBoardPiece);

    // A rook that just took a minor piece and can be taken back by one is a favourable
    // exchange (rook for two minors), not a hanging rook.
    if (
        playedMove?.captured &&
        piece.type === "r" &&
        PIECE_VALUES[playedMove.captured] === PIECE_VALUES.n &&
        attackers.length === 1 &&
        defenders.length > 0 &&
        PIECE_VALUES[attackers[0].type] === PIECE_VALUES.n
    ) {
        return true;
    }

    if (
        directAttackers.some((attacker) => PIECE_VALUES[attacker.type] < PIECE_VALUES[piece.type])
    ) {
        return false;
    }

    if (attackers.length <= defenders.length) return true;

    if (directAttackers.length === 0) return true;
    const lowestValueAttacker = directAttackers.reduce((min, a) =>
        PIECE_VALUES[a.type] < PIECE_VALUES[min.type] ? a : min
    );

    // The piece is worth less than the attacker, and a cheap-enough defender would recapture —
    // so taking it loses the attacker material overall.
    if (
        PIECE_VALUES[piece.type] < PIECE_VALUES[lowestValueAttacker.type] &&
        defenders.some((d) => PIECE_VALUES[d.type] < PIECE_VALUES[lowestValueAttacker.type])
    ) {
        return true;
    }

    return defenders.some((d) => d.type === "p");
};

// Pieces worth no more than what `playedMove` just captured are a trade, not a hanging piece.
export const getUnsafePieces = (board: Chess, color: Color, playedMove?: Move): BoardPiece[] => {
    const capturedValue = playedMove?.captured ? PIECE_VALUES[playedMove.captured] : 0;

    return getBoardPieces(board).filter(
        (piece) =>
            piece.color === color &&
            piece.type !== "p" &&
            piece.type !== "k" &&
            PIECE_VALUES[piece.type] > capturedValue &&
            !isPieceSafe(board, piece, playedMove)
    );
};

// Attacks on `color`'s unsafe pieces (other than `threatenedPiece`) worth at least as much as it.
const relativeUnsafePieceAttacks = (
    board: Chess,
    threatenedPiece: BoardPiece,
    color: Color,
    playedMove?: Move
): RawMove[] =>
    getUnsafePieces(board, color, playedMove)
        .filter(
            (unsafe) =>
                unsafe.square !== threatenedPiece.square &&
                PIECE_VALUES[unsafe.type] >= PIECE_VALUES[threatenedPiece.type]
        )
        .flatMap((unsafe) => getAttackingMoves(board, unsafe, false));

const allowsCheckmate = (board: Chess): boolean => board.moves().some((san) => san.includes("#"));

// Whether playing `actingMove` (e.g. moving `threatenedPiece` away) newly exposes an equal or
// bigger target of the acting side, or a lower-value piece leaving allows mate.
export const moveCreatesGreaterThreat = (
    board: Chess,
    threatenedPiece: BoardPiece,
    actingMove: RawMove
): boolean => {
    const actionBoard = new Chess(board.fen());
    const previousAttacks = relativeUnsafePieceAttacks(
        actionBoard,
        threatenedPiece,
        actingMove.color
    );

    let playedMove: Move;
    try {
        playedMove = actionBoard.move(actingMove);
    } catch {
        return false;
    }

    const attacks = relativeUnsafePieceAttacks(
        actionBoard,
        threatenedPiece,
        actingMove.color,
        playedMove
    );
    if (attacks.some((a) => !previousAttacks.some((b) => isSameRawMove(a, b)))) return true;

    return PIECE_VALUES[threatenedPiece.type] < PIECE_VALUES.q && allowsCheckmate(actionBoard);
};

// Whether, after `actingMove` (e.g. capturing `threatenedPiece`), the acting side has any equal
// or bigger target hanging, or a lower-value capture walks into mate.
export const moveLeavesGreaterThreat = (
    board: Chess,
    threatenedPiece: BoardPiece,
    actingMove: RawMove
): boolean => {
    const actionBoard = new Chess(board.fen());
    try {
        actionBoard.move(actingMove);
    } catch {
        return false;
    }

    if (relativeUnsafePieceAttacks(actionBoard, threatenedPiece, actingMove.color).length > 0) {
        return true;
    }

    return PIECE_VALUES[threatenedPiece.type] < PIECE_VALUES.q && allowsCheckmate(actionBoard);
};

// Whether every acting move on `threatenedPiece` costs the acting side at least as much.
export const hasDangerLevels = (
    board: Chess,
    threatenedPiece: BoardPiece,
    actingMoves: RawMove[],
    equalityStrategy: "creates" | "leaves" = "leaves"
): boolean =>
    actingMoves.every((move) =>
        equalityStrategy === "creates"
            ? moveCreatesGreaterThreat(board, threatenedPiece, move)
            : moveLeavesGreaterThreat(board, threatenedPiece, move)
    );

export const isPieceTrapped = (board: Chess, piece: BoardPiece, dangerLevels = true): boolean => {
    const calibrated = new Chess(setFenTurn(board.fen(), piece.color));
    if (isPieceSafe(calibrated, piece)) return false;

    return calibrated.moves({ square: piece.square, verbose: true }).every((move) => {
        if (move.captured === "k") return false;

        const escapeBoard = new Chess(calibrated.fen());
        if (dangerLevels && moveCreatesGreaterThreat(escapeBoard, piece, toRawMove(move))) {
            return true;
        }

        const escapeMove = escapeBoard.move(move);
        return !isPieceSafe(escapeBoard, { ...piece, square: escapeMove.to }, escapeMove);
    });
};
