# Move Classification

How moves get tagged as Best, Blunder, Brilliant, etc.

## Why not raw centipawns

A 300cp swing means very different things depending on where it starts: +1500 → +1200 is still a
crushing win, but +50 → -250 just lost the game. So judgements are made on **win probability**
(derived from cp via a logistic curve), not on cp directly, and cp is capped before conversion so
an already-decided position can't produce an artificially dramatic swing.

## Score representation

`Score` (`src/types/index.ts`) is a tagged union: `{ kind: "cp", cp }` or `{ kind: "mate", mate }`,
always from White's point of view. Mate is a real, distinct variant — never faked as `±30000` cp —
so every consumer has to handle it on purpose. `src/utils/score.ts` exposes the only three
operations anything needs: flip side (`invertScore`), view from a color (`povScore`), and format
for display (`formatScore`, e.g. `"+1.23"` / `"M3"`).

## Converting cp to win probability

```
winningChances(cp) = clamp(2 / (1 + e^(-0.00368208 × clamp(cp, ±1000))) − 1, ±1)
winPercentage(cp)  = 50 + 50 × winningChances(cp)
```

Capping at ±1000 before the logistic is what makes blowout positions numerically harmless. A
forced mate is treated as ±1000 (signed by direction) and pushed through the same formula — no
separate constant, no special-casing the curve itself. `winPercentage` only feeds the separate
per-game accuracy score, not move classification.

## Judging a move: two paths

**Plain cp → cp.** Work out how much winning-chances (on a −1..+1 scale) the mover gave up, then
bucket it:

| Chances lost ≥ | Class |
|---|---|
| 0.30 | Blunder |
| 0.20 | Mistake |
| 0.10 | Inaccuracy |
| 0.05 | Good |
| 0.02 | Excellent |
| below that | Best (or exact engine-top match) |

**Mate transitions.** Triggered only when a forced mate appears, vanishes, or flips side. Judged
by the *surviving* cp eval, not by re-running mate through the win-probability curve:
- Mate just appeared against the mover → grade by their eval *before* the blunder.
- A winning mate was lost or flipped → grade by the eval *after*.
- Mate only got longer or shorter, never actually lost → no penalty; treated as a clean move.

This is why giving up a forced mate while still comfortably ahead reads as a minor Inaccuracy
rather than a Blunder, and why delaying/shortening a mate you already had is never flagged.

**Delivering checkmate.** Stockfish reports a delivered mate as `score mate 0`, a terminal
sentinel that doesn't fit either sign bucket above (it would otherwise look like a lost mate and
score as a Blunder). Detected directly via `chess.isCheckmate()` and force-classified as Best
before any other rule runs.

## Forced, Critical, and Brilliant

Built on top of a small set of board primitives in `src/utils/tactics.ts`:
- **Attackers**, including revealed/X-ray attackers behind the first piece.
- **Defenders**, counting the fewest recaptures available after the opponent's best capturing
  choice.
- **Piece safety**, false if attackers outnumber defenders with no good recapture, or a cheaper
  piece can take it outright.
- **Trapped pieces**, unsafe both where they stand and everywhere they could move to.

From these:
- **Forced** — the position before the move had at most one legal reply; nothing to judge, no
  engine call needed.
- **Critical** — needs a second engine line (MultiPV 2). If the runner-up move was still
  comfortably winning, finding the top move wasn't actually critical; if instead it loses a
  meaningful chunk of win-chances, the position demanded precision and gets tagged Critical
  instead of plain Best.
- **Brilliant** — must already grade as Best or Critical, and must leave a genuinely unsafe piece
  of the mover's own behind (not a retreat, not a promotion, not a piece that was doomed anyway) —
  i.e. a real, intentional sacrifice.

---

## Inspiration

This approach adapts ideas from Lichess's open-source analysis code:
- [scalachess `eval.scala`](https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala) — winning-chances curve
- [lila `Advice.scala`](https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala) — cp/mate judgement thresholds
- [lila `AccuracyPercent.scala`](https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala) — per-game accuracy curve

The Good/Excellent/Best subdivisions, Forced/Critical/Brilliant tagging, and the tactics
primitives behind them are this project's own extensions, not part of the Lichess model.
