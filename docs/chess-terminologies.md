# Chess Terminologies

A reference for every chess and engine term used in this codebase.

---

## Board & Move Notation

### FEN (Forsyth-Edwards Notation)
A single-line string that fully describes a board position.
Example: `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1`

Six space-separated fields:
1. Piece placement (rows separated by `/`, uppercase = White, lowercase = Black, digits = empty squares)
2. Active color (`w` or `b`)
3. Castling rights (`KQkq`, `-` if none)
4. En passant target square (`e3`, or `-`)
5. Halfmove clock (moves since last capture or pawn push)
6. Fullmove number (increments after Black's move)

Used in this codebase as `fenBefore` and `fen` (after the move) on every `MoveNode`, so the engine receives an exact position without replaying the full game.

### SAN (Standard Algebraic Notation)
The human-readable move format used in PGN files and displayed in the move list.
Examples: `e4`, `Nf3`, `O-O`, `Bxc6+`, `Qxf7#`

### UCI (Universal Chess Interface)
A text protocol for communicating with chess engines. Moves are written in long algebraic form: `<from><to>[promotion]`.
Examples: `e2e4`, `g1f3`, `e7e8q`

Used as `uci` on `MoveNode` and in engine commands like `position fen <fen> moves <uci>`.

### PGN (Portable Game Notation)
A standard file format for recording complete chess games, including headers (players, date, result) and moves in SAN.
The app accepts PGN as the primary input.

### Ply
A single half-move — one move by one player. Two plies make a full move.
- Ply 0 = position after White's first move
- Ply 1 = position after Black's first move

`currentPly` in the codebase is the index into the moves array tracking which position is displayed on the board. `-1` means the starting position before any moves.

### En Passant
A special pawn capture that can occur when a pawn advances two squares from its starting rank and lands beside an opponent's pawn. The opponent may capture it as if it had only moved one square. Encoded in FEN as the target square.

### Castling
A special move where the king moves two squares toward a rook and the rook jumps to the other side of the king. Detected in SAN by `O-O` (kingside) or `O-O-O` (queenside). Plays a distinct sound in this app.

---

## Engine & Evaluation

### Centipawn (cp)
The standard unit of chess evaluation. 100 centipawns = 1 pawn of advantage.
- Positive values favour White, negative values favour Black.
- Example: `+150` means White is up roughly 1.5 pawns.

Stored as `scoreCP` and `evalBefore`/`evalAfter` on `ClassifiedMove`. All scores in the codebase use **White's point of view** (engine output is normalised by negating when it is Black's turn).

### Depth
The number of half-moves (plies) ahead the engine searches. Higher depth = stronger but slower analysis.
Default is `DEFAULT_DEPTH = 15`. Options: 10, 12, 15, 18, 22.

### Principal Variation (PV)
The sequence of best moves the engine has found at the current search depth, stored as a list of UCI moves.
Displayed as "Continuation" in the move detail panel.

### Best Move
The engine's top recommended move from a given position (`bestMove` in UCI output and on `ClassifiedMove`).

### Ponder
The move the engine expects the opponent to play after the best move. Used internally by UCI but not displayed in this app.

### MultiPV
A UCI option to make the engine return the top N moves instead of just one. This app uses `multipv 1` (single best line).

### Mate Score
When the engine sees a forced checkmate, it reports `score mate N` instead of centipawns.
- Positive N = White mates in N moves
- Negative N = Black mates in N moves

Stored as `scoreMate` on `AnalysisResult` and `ClassifiedMove`. Represented as ±30 000 cp internally.

### Win Probability
Converts a centipawn score to a 0–100% probability of winning, using a logistic curve (Lichess formula):

```
winP(cp) = 50 + 50 × (2 / (1 + exp(−0.00368208 × cp)) − 1)
```

Used to compute accuracy — working with win-probability drops is more meaningful than raw centipawn drops because the relationship between centipawns and game outcome is non-linear.

---

## Move Classification

### Delta
How many centipawns worse the played move is compared to the engine's best move. Always ≥ 0.

```
delta (White) = max(0, bestEvalBefore − evalAfter)
delta (Black) = max(0, evalAfter − bestEvalBefore)
```

Delta drives the `MoveClass` assigned to each move.

### MoveClass (enum)
The quality label assigned to each move based on its delta:

| Class | Delta threshold | Colour |
|---|---|---|
| Brilliant | Special (see below) | Teal |
| Best | < 3 cp | Green |
| Excellent | < 10 cp | Green |
| Good | < 25 cp | — (no badge) |
| Inaccuracy | < 75 cp | Yellow |
| Mistake | < 150 cp | Orange |
| Blunder | ≥ 150 cp | Red |

### Brilliant
A move that is not the engine's top choice yet improves the position by more than 50 cp compared to the position before. Rare — reserved for genuinely sacrificial or counter-intuitive moves.

### Accuracy
A 0–100% score summarising the overall quality of all moves by one player. Computed using the Lichess formula:

```
avgDrop = average win-probability drop across all moves (floored at 0)
accuracy = 103.1668 × exp(−0.04354 × avgDrop) − 3.1669
```

Clamped to [0, 100] and rounded to one decimal place.

---

## Stockfish & WASM

### Stockfish
The world's strongest open-source chess engine. This app compiles it to WebAssembly so it runs entirely in the browser with no server.

### WASM (WebAssembly)
A binary instruction format that runs in the browser at near-native speed. Stockfish is compiled to WASM via Emscripten.

### UCI (protocol)
The text-based protocol used to talk to Stockfish. Key commands used in this app:

| Command | Meaning |
|---|---|
| `uci` | Initialise engine, get capabilities |
| `isready` | Ping — engine replies `readyok` |
| `position fen <fen>` | Set board position |
| `go depth <n>` | Search to depth n, return best move |
| `bestmove <uci>` | Engine's reply with top move |

### NNUE (Efficiently Updatable Neural Network)
The neural-network evaluation function built into modern Stockfish. Replaces traditional hand-crafted piece-value tables with a learned model, dramatically improving positional understanding.
