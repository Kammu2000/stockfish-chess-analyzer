// libs
import { CSSProperties, useCallback, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard";

// store actions
import { playMove } from "../store/variationActions";

export interface PendingPromotion {
    from: string;
    to: string;
    color: "w" | "b";
}

export interface BoardMoves {
    canDragPiece: (args: PieceHandlerArgs) => boolean;
    onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
    onSquareClick: (args: SquareHandlerArgs) => void;
    squareStyles: Record<string, CSSProperties>;
    promotion: PendingPromotion | null;
    choosePromotion: (piece: "q" | "r" | "b" | "n") => void;
    cancelPromotion: () => void;
}

const SELECTED_STYLE: CSSProperties = { backgroundColor: "rgba(255, 214, 10, 0.45)" };
const TARGET_STYLE: CSSProperties = {
    background: "radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 24%)",
};
const CAPTURE_STYLE: CSSProperties = {
    background: "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)",
};

// Drag-and-drop and click-to-move for the position `fen`. Moves are handed to playMove, which
// re-uses the main line / an existing variation or creates a new evaluated variation.
export const useBoardMoves = (fen: string, enabled: boolean): BoardMoves => {
    // Both are tagged with the FEN they were made on, so they're dropped as soon as the
    // position changes (no reset effect that could race a quick click).
    const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null);
    const [pendingPromotion, setPendingPromotion] = useState<
        (PendingPromotion & { fen: string }) | null
    >(null);

    const selected = enabled && selection?.fen === fen ? selection.square : null;
    const promotion = enabled && pendingPromotion?.fen === fen ? pendingPromotion : null;
    const setSelected = useCallback(
        (square: string | null) => setSelection(square ? { fen, square } : null),
        [fen]
    );
    const setPromotion = useCallback(
        (p: PendingPromotion | null) => setPendingPromotion(p ? { ...p, fen } : null),
        [fen]
    );

    const board = useMemo(() => new Chess(fen), [fen]);

    const legalFrom = useCallback(
        (square: string) =>
            enabled ? board.moves({ square: square as Square, verbose: true }) : [],
        [board, enabled]
    );

    // Returns true if the move was played (or is awaiting a promotion choice).
    const tryMove = useCallback(
        (from: string, to: string): boolean => {
            const matches = legalFrom(from).filter((m) => m.to === to);
            if (matches.length === 0) return false;

            if (matches.some((m) => m.promotion)) {
                setPromotion({ from, to, color: board.turn() });
                return true;
            }
            return playMove(from + to);
        },
        [board, legalFrom, setPromotion]
    );

    const canDragPiece = useCallback(
        ({ piece }: PieceHandlerArgs) => enabled && piece.pieceType[0] === board.turn(),
        [board, enabled]
    );

    const onPieceDrop = useCallback(
        ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
            setSelected(null);
            if (!targetSquare || targetSquare === sourceSquare) return false;
            // The promotion picker plays the move later; snap the pawn back meanwhile.
            return tryMove(sourceSquare, targetSquare) && !promotionNeeded(board, sourceSquare);
        },
        [board, tryMove, setSelected]
    );

    const onSquareClick = useCallback(
        ({ piece, square }: SquareHandlerArgs) => {
            if (!enabled) return;

            if (selected && selected !== square && tryMove(selected, square)) {
                setSelected(null);
                return;
            }
            const ownPiece = piece !== null && piece.pieceType[0] === board.turn();
            setSelected(ownPiece && selected !== square ? square : null);
        },
        [board, enabled, selected, tryMove, setSelected]
    );

    const squareStyles = useMemo(() => {
        const styles: Record<string, CSSProperties> = {};
        if (!selected) return styles;

        styles[selected] = SELECTED_STYLE;
        for (const m of legalFrom(selected)) {
            styles[m.to] = m.captured ? CAPTURE_STYLE : TARGET_STYLE;
        }
        return styles;
    }, [selected, legalFrom]);

    const choosePromotion = useCallback(
        (piece: "q" | "r" | "b" | "n") => {
            if (promotion) playMove(promotion.from + promotion.to + piece);
            setPromotion(null);
        },
        [promotion, setPromotion]
    );

    const cancelPromotion = useCallback(() => setPromotion(null), [setPromotion]);

    return {
        canDragPiece,
        onPieceDrop,
        onSquareClick,
        squareStyles,
        promotion,
        choosePromotion,
        cancelPromotion,
    };
};

const promotionNeeded = (board: Chess, from: string): boolean => {
    const piece = board.get(from as Square);
    return piece?.type === "p" && (from[1] === "7" || from[1] === "2");
};
