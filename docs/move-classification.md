# Move Classification: How We Tag Every Move Class

## The core idea

Raw centipawn (cp) deltas are a bad metric on their own: a 300cp drop from +1500 to +1200 is
irrelevant (still totally winning), while the same 300cp drop from +50 to -250 is a real blunder.
The fix is to compare **win probability**, not cp, and to cap cp inputs before converting — so an
already-decided position can't produce a dramatic swing just because the number got bigger.

This is exactly what [lichess](https://lichess.org) does, and our implementation
(`src/utils/moveClassifier.ts`) ports their algorithm directly rather than inventing our own.

## The `Score` type

An engine evaluation is `{ kind: "cp"; cp: number } | { kind: "mate"; mate: number }`
(`src/types/index.ts`), always White-absolute. Mate is never smuggled through as a fake
centipawn value (e.g. `±30000`) — it's a distinct case the type system forces every consumer to
handle explicitly. `src/utils/score.ts` holds the only three operations needed on it:
`invertScore` (side-swap), `povScore` (view from a given color), `formatScore` (`"+1.23"` / `"M3"`
for display). This is also why a mate is no longer a special case in the UI — `EvaluationBar` and
`MoveDetail` just call `formatScore`.

## Sources

- [`scalachess/core/src/main/scala/eval.scala`](https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala) — the `WinPercent.winningChances` / `fromCentiPawns` / `fromMate` model
- [`lila/modules/tree/src/main/Advice.scala`](https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala) — `CpAdvice` (cp-vs-cp judgement) and `MateAdvice` (mate-transition judgement)
- [`lila/modules/analyse/src/main/AccuracyPercent.scala`](https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala) — the per-game accuracy % curve (already ported in `computeAccuracy`, unchanged by this work)
- [chess.com](https://www.chess.com)'s Game Review — the inspiration for Brilliant, Critical ("Great Move"), and Forced, which lichess doesn't have. chess.com's classifier itself isn't open source, so `src/utils/tactics.ts` and `src/utils/moveClassifier.ts` implement the underlying tactical idea (a board-computed sacrifice-safety and only-move check) from scratch.

## The winning-chances model

```
winningChances(cp) = clamp(2 / (1 + exp(-0.00368208 × clamp(cp, -1000, 1000))) - 1, -1, 1)
```

- Centipawns are capped at `±CP_CEILING` (1000) *before* the logistic — this cap is what makes
  "still winning" positions harmless: +1500 and +900 both saturate to the same input.
- A forced mate is treated as `±CP_CEILING` signed by mate direction, then run through the same
  formula — no separate magic number, no special-casing in the curve itself.
- `winPercentage(cp) = 50 + 50 × winningChances(cp)` gives a 0–100 White win probability, used
  only by the accuracy percentage (a separate consumer of the same curve, per lichess).

## Two independent judgement paths

Lichess never diffs a mate score against a cp score through the winning-chances formula — mate
transitions are judged separately, by looking at the plain cp value on the side that still has
one. We mirror that split exactly:

### 1. Plain cp → cp (`classifyByWinningChancesLost`)

Compute how much winning-chances the mover gave up, from their own side's perspective:

```
chancesLost = mover's winningChances(before) - winningChances(after)
```

Bucketed against thresholds on the `[-1, +1]` scale:

| chancesLost ≥ | Class | Source |
|---|---|---|
| 0.3 | Blunder | lichess `CpAdvice` |
| 0.2 | Mistake | lichess `CpAdvice` |
| 0.1 | Inaccuracy | lichess `CpAdvice` |
| 0.05 | Good | our own subdivision (lichess gives no judgement below Inaccuracy) |
| 0.02 | Excellent | our own subdivision |
| — | Best | our own subdivision, or an exact match with the engine's top move |

Lichess only has the negative three categories. We split their "no judgement" zone into
Good/Excellent/Best purely for a nicer UI — those two extra cutoffs (0.05, 0.02) are our choice,
not lichess's.

### 2. Mate transitions (`classifyMateTransition`)

Fires only when a forced mate appears, disappears, or flips sign relative to the mover. Judges by
the surviving side's plain cp eval, not by running mate through the winning-chances curve:

- **Mate just appeared against the mover** → judge by how good their position was *before* the
  blunder (in cp, from their POV): `< -999` → Inaccuracy, `< -700` → Mistake, else → Blunder.
- **Mover had a winning mate and it's now gone (or flipped)** → judge by the eval *after* (0 if it
  flipped straight into an opponent mate): `> 999` → Inaccuracy, `> 700` → Mistake, else → Blunder.
- **Mate merely delayed or shortened, never actually lost** (e.g. mate-in-5 → mate-in-3) → no
  judgement from this path; we treat it as a clean move (Best/Excellent), since nothing went wrong.

This is why losing a forced mate while still up +1200 correctly reads as a minor Inaccuracy, not a
Blunder — and why shortening or delaying a mate you already had never gets flagged as an error.

### 3. Delivering checkmate (special case)

Stockfish reports an already-delivered checkmate as `score mate 0` — a terminal sentinel, not a
real "mate in N for the side to move" value. `0` is neither `> 0` nor `< 0`, so it doesn't fit
`classifyMateTransition`'s sign convention: the move that actually delivers mate would otherwise
look like "had a winning mate, now doesn't" and get misclassified as a Blunder. We check the
resulting position directly (`chess.isCheckmate()`) and force `Best` before any other path runs —
delivering checkmate is definitionally the best possible move.

## Beyond lichess: Forced, Critical, and Brilliant

Lichess only ever gives Inaccuracy/Mistake/Blunder or no judgement at all — it has no equivalent
of chess.com's "Great move" or "Brilliant." Our first attempt at Brilliant was an eval-swing guess
("big positive swing + not the engine's top pick") and we explicitly ripped it out for being a
hack indistinguishable from noise (see git history). This section is what replaced it: a
board-computed tactical model, not a heuristic on the eval curve.

### `src/utils/tactics.ts`: real attacker/defender/safety primitives

- `attackingSquares(board, square, color)` — every square from which `color` attacks `square`,
  including **revealed X-ray/battery attackers** (a rook behind a rook). Built on chess.js's
  `attackers()` (a direct, single-ply query) by iteratively removing the front attacker and
  recomputing on the reduced board.
- `defendingSquares(board, piece)` — for each way the opponent could capture `piece`, how many
  recapture options its owner has afterwards, taking the attacker choice that leaves the *fewest*
  recaptures (the opponent's best try).
- `isPieceSafe(board, piece)` — false if there's a lower-value direct attacker, or attackers
  outnumber defenders with no favorable/breakeven recapture chain.
- `isPieceTrapped(board, piece)` — true if the piece is unsafe where it stands *and* every square
  it could move to is also unsafe. A piece with no future isn't a real sacrifice if given up.

### Forced

The previous position had ≤1 legal move — there was nothing to classify. Purely local (no engine
call needed): `new Chess(move.fenBefore).moves().length <= 1`.

### Critical ("only move")

Requires a second engine line (**MultiPV 2** — `MULTI_PV` in `constants/analysis.ts`, configured
once via UCI `setoption` in `engineService.ts`). A move is a *candidate* for Critical when it's
not a forced response to check, not a queen promotion, not just capturing a piece that was already
hanging (obvious, not hard to find), doesn't lose, and — the key check — the **runner-up line
loses real ground**: if the 2nd-best move was still comfortably winning (`≥700cp`, `CRITICAL_RUNNER_UP_SAFE_CP`),
finding the top move wasn't actually critical. Among candidates, if the runner-up line loses
`≥10%` win-chances (`CRITICAL_THRESHOLD`) compared to the top line, the position demanded
precision — tagged Critical instead of plain Best.

### Brilliant

Gated by the same candidate check as Critical, plus: the move must already grade as Best or
Critical, and must leave (or keep) a genuinely unsafe piece of the mover's own — not simply
retreating everything to safety (unless it's check), not a queen promotion, and not a piece that
was trapped anyway with no future. Concretely: compare `getUnsafePieces` before vs. after the
move; if unsafe pieces increased (or the move gives check) and the newly-unsafe pieces aren't just
doomed leftovers, it's a real sacrifice.
