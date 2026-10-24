# Chess Terminologies

Quick reference for chess/engine terms used in this codebase.

## Board & Move Notation

- **FEN** — single-line board state string (`fenBefore`/`fen` on `MoveNode`).
- **SAN** — human-readable move notation (`e4`, `Nf3`, `O-O`) used in PGN/move list.
- **UCI** — `<from><to>[promotion]` move format (`e2e4`) used for engine commands; stored as `uci`.
- **PGN** — standard chess game file format; the app's primary input.
- **Ply** — one half-move; `currentPly` indexes the displayed position (`-1` = start).
- **En passant** — special pawn capture of a pawn that just moved two squares.
- **Castling** — king+rook special move, SAN `O-O`/`O-O-O`.

## Engine & Evaluation

- **Centipawn (cp)** — 100 = 1 pawn advantage; positive favours White (`scoreCP`, `evalBefore`/`evalAfter`, all White-POV).
- **Depth** — plies searched ahead; `DEFAULT_DEPTH = 15`.
- **Principal Variation (PV)** — engine's best line, shown as "Continuation".
- **Best move** — engine's top move (`bestMove`).
- **Ponder** — expected opponent reply; not shown in this app.
- **MultiPV** — number of top lines returned; app uses `multipv 1`.
- **Mate score** — forced mate in N plies (`score mate N`); stored as `scoreMate`, ±30000 cp internally.
- **Win probability** — logistic conversion of cp to 0–100% win chance; used for accuracy.

## Move Classification

- **Delta** — centipawns lost vs. best move (≥ 0); drives `MoveClass`.
- **MoveClass** — quality label from delta: Brilliant, Best, Excellent, Good, Inaccuracy, Mistake, Blunder.
- **Brilliant** — non-engine-top move that still gains > 50 cp; rare/sacrificial.
- **Accuracy** — 0–100% score from average win-probability drop across a player's moves.

## Stockfish 

- **Stockfish** — open-source chess engine, compiled to WASM, runs in-browser.
- **UCI (protocol)** — text protocol to the engine: `uci`, `isready`, `position fen <fen>`, `go depth <n>`, `bestmove <uci>`.
- **NNUE** — neural-network position evaluation used internally by modern Stockfish.
