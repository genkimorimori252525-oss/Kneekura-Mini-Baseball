# P1 NPB Rule Gap Audit — 2026-09-18

**Status:** ACTIVE GAP-CLOSURE PLAN.

**Parent roadmap:** P1 — NPB rule core.

This audit compares the current `jolly/core-realism-2026-09-18` implementation against the P1 rule requirements in `docs/game-design/02-rules-ratings-defense.md` and `docs/game-design/03-roadmap.md`.

## P1 acceptance map

| Requirement | State | Current evidence | Remaining gap |
| --- | --- | --- | --- |
| R-01 4 balls / 3 strikes / 3 outs | **partial** | `CanonicalMatchState` carries balls/strikes/outs | no authoritative pitch-count transition rule; no half-inning transition boundary |
| R-02 foul / two-strike foul / foul bunt | **missing** | none dedicated | add count semantics: ordinary foul cannot create strike three; two-strike foul bunt can |
| R-03 foul fly | **partial** | `FlyCatchRule` separates secured catch vs ground contact | no fair/foul territory fact integrated with fly-catch result |
| R-04 force obligations | **advanced** | `ForceObligation`, transition/satisfaction, force-out vertical slices | retain audit coverage |
| R-05 tag after force dissolves | **advanced** | `TagArrivalRule`, force-dissolution/tag-arrival regressions | retain audit coverage |
| R-06 third out / scoring | **advanced** | batter-runner-before-first, force/time-play scoring, pending-run finalization | retain audit coverage |
| R-07 tag-up / appeal | **advanced** | fly-catch/tag-up vertical slice, appeal window/scoring, fourth-out handling | retain audit coverage |
| R-08 infield fly | **missing** | no dedicated rule module found | add applicability, batter-out declaration, force-removal semantics, dropped-ball runner state |

Additional NPB-2026 RuleProfile / defensive-alignment work is already substantially implemented but does not substitute for the above P1 acceptance cases.

## Gap-closing order

1. **R-01 / R-02 pitch-count and foul semantics**
   - pure rule transition first;
   - ordinary foul with two strikes preserves two strikes;
   - foul bunt with two strikes produces strike three;
   - four balls / three strikes produce terminal plate-appearance outcomes.
2. **R-08 infield fly**
   - applicability conditions;
   - batter declared out independently of catch;
   - remove batter-created force obligations when declared;
   - distinguish caught vs dropped ball for runner tag-up/live-ball state.
3. **R-03 foul-fly territory integration**
   - fair/foul physical fact;
   - secured foul fly => batter out;
   - uncaught foul ball => dead/foul count transition;
   - do not duplicate catch physics.
4. **R-01 half-inning transition**
   - three outs transition inning half / clear bases / reset count;
   - keep scoring finalization ordered before transition.
5. P1 acceptance matrix regression over all roadmap-required cases.

## Boundary with P2

P1 owns the correctness of count/rule transitions.

P2 will own the canonical chronological plate-appearance timeline that supplies the physical/pitch events to those rules.

Do not implement a second pitch simulator inside P1.

## Current CI caveat

GitHub Actions continues to fail before workflow steps execute (`steps=[]`). P1 gap work may advance with TDD/source evidence, but repository GREEN must not be claimed until CI executes commands successfully.
