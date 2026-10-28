# Move Classification

How moves get tagged as Best, Blunder, Brilliant, etc.

## Why not raw centipawns

A 300cp swing means very different things depending on where it starts: +1500 → +1200 is still a
crushing win, but +50 → -250 just lost the game. So judgements are made on **expected points**
(the mover's expected game score, 0 = loss … 1 = win, derived from cp via a logistic curve) — the
same model chess.com's Game Review uses — not on cp directly.

## Score representation

`Score` (`src/types/index.ts`) is a tagged union: `{ kind: "cp", cp }` or `{ kind: "mate", mate }`,
always from White's point of view. Mate is a real, distinct variant — never faked as `±30000` cp —
so every consumer has to handle it on purpose. `src/utils/score.ts` exposes the only three
operations anything needs: flip side (`invertScore`), view from a color (`povScore`), and format
for display (`formatScore`, e.g. `"+1.23"` / `"M3"`).

## Converting cp to expected points

```
expectedPoints(cp)   = 1 / (1 + e^(-0.0035 × cp))      (mover's point of view)
expectedPoints(mate) = 1 if the mover is mating, 0 if being mated
pointsLost           = max(0, expectedPoints(before) − expectedPoints(after))
```

## Judging a move

**The engine's top move is always Best**, whatever the evals say (the before/after searches are
separate and can disagree slightly). Every other move is graded as follows.

**Plain cp → cp.** Bucket the expected points lost using chess.com's published thresholds:

| Points lost | Class |
|---|---|
| 0 | Best |
| ≤ 0.02 | Excellent |
| ≤ 0.05 | Good |
| ≤ 0.10 | Inaccuracy |
| ≤ 0.20 | Mistake |
| > 0.20 | Blunder |

**Mate transitions.** The expected-points curve saturates (mate in 2 and mate in 20 are both
"1.0"), so forced mates are judged on their own terms:
- **Had a mate, now only cp** → by the surviving advantage: ≥ +800 Excellent, ≥ +400 Good,
  ≥ +200 Inaccuracy, ≥ 0 Mistake, otherwise Blunder.
- **cp, now a mate** → for the mover: Best. Against the mover: mate in ≤ 2 Blunder, ≤ 5 Mistake,
  otherwise Inaccuracy.
- **Mate → mate, same side** → by how much longer it got: the winner should bring it one move
  closer and the defender should hold the distance (Best); +1 move Excellent, < +7 Good, else
  Inaccuracy.
- **Winning mate flipped into a losing one** → Blunder, or Mistake if the mate against is > 3 moves.

Any remaining case (e.g. escaping a mate the engine had predicted) falls back to expected points.

**Delivering checkmate.** Stockfish reports a delivered mate as `score mate 0`, a terminal
sentinel. Detected directly via `chess.isCheckmate()` and force-classified as Best before any
other rule runs.

## Forced, Critical, and Brilliant

Built on a set of board primitives in `src/utils/tactics.ts`:
- **Attackers** — *legal* captures only (an absolutely pinned piece doesn't count), plus a king
  covering the square; X-ray attackers are found through batteries of any depth.
- **Defenders** — the fewest recaptures available after the opponent's best capturing choice.
- **Piece safety** — unsafe if a cheaper piece can take it, or attackers outnumber defenders with
  no cheap/pawn recapture. A rook that just took a minor and can be retaken by one counts as safe
  (rook for two minors).
- **Danger levels** — whether capturing (or moving) a piece costs the acting side an equal or
  bigger piece, or allows mate.
- **Trapped pieces** — unsafe where they stand and on every escape square (or escaping creates a
  bigger threat).

From these:
- **Forced** — the position before the move had at most one legal reply.
- **Critical candidate** (shared precondition) — not escaping check, not a queen promotion, not
  losing afterwards, and not still ≥ +700 with the runner-up move (MultiPV 2).
- **Critical** — the engine's top move, where the runner-up would have lost ≥ 0.10 expected
  points. Never for a move that keeps a forced mate, or that just captures free material.
- **Brilliant** — must already be Best/Critical, not a promotion, and leave one of the mover's
  pieces genuinely unsafe: not a retreat to safety, not a trade (pieces worth ≤ what was just
  captured are ignored), not a fake sacrifice whose every capture backfires, and not a piece that
  was doomed (trapped) anyway.

---

## Inspiration

- [chess.com: How are moves classified?](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc) — expected-points thresholds
- [WintrChess](https://github.com/WintrCat/wintrchess) — mate-transition rules, Critical/Brilliant
  logic and the attacker/defender/danger-level primitives
- [lila `AccuracyPercent.scala`](https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala) — per-game accuracy curve (`computeAccuracy`, still on Lichess's win-percentage scale)
