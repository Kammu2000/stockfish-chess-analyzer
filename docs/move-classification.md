# Move Classification: How We Tag Best/Excellent/Good/Inaccuracy/Mistake/Blunder

## The core idea

Raw centipawn (cp) deltas are a bad metric on their own: a 300cp drop from +1500 to +1200 is
irrelevant (still totally winning), while the same 300cp drop from +50 to -250 is a real blunder.
The fix is to compare **win probability**, not cp, and to cap cp inputs before converting — so an
already-decided position can't produce a dramatic swing just because the number got bigger.

This is exactly what [lichess](https://lichess.org) does, and our implementation
(`src/utils/moveClassifier.ts`) ports their algorithm directly rather than inventing our own.

## Sources

- [`scalachess/core/src/main/scala/eval.scala`](https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala) — the `WinPercent.winningChances` / `fromCentiPawns` / `fromMate` model
- [`lila/modules/tree/src/main/Advice.scala`](https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala) — `CpAdvice` (cp-vs-cp judgement) and `MateAdvice` (mate-transition judgement)
- [`lila/modules/analyse/src/main/AccuracyPercent.scala`](https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala) — the per-game accuracy % curve (already ported in `computeAccuracy`, unchanged by this work)

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

## What we deliberately don't have

No "Brilliant" tag. It requires reliably detecting a genuine sacrifice plus "this was still the
best or near-best move," which is easy to get wrong and easy to fake with eval-only heuristics
(our first attempt was exactly that kind of hack). Lichess doesn't have it either — we followed
their judgement.
