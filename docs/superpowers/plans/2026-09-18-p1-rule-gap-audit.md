# P1 NPB Rule Gap Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P1 — NPB rule core.

This audit compares the current `jolly/core-realism-2026-09-18` implementation against the P1 rule requirements in `docs/game-design/02-rules-ratings-defense.md` and `docs/game-design/03-roadmap.md`.

## P1 acceptance map

| Requirement | State | Current evidence | Remaining gap |
| --- | --- | --- | --- |
| R-01 4 balls / 3 strikes / 3 outs | **implemented** | `PitchCountRule`, `HalfInningTransitionRule`, `CanonicalMatchState` | CI execution still externally blocked |
| R-02 foul / two-strike foul / foul bunt | **implemented** | `PitchCountRule` | CI execution still externally blocked |
| R-03 foul fly | **implemented** | `FlyCatchRule` + `FoulBallRule` | P2 still owns physical fair/foul fact generation |
| R-04 force obligations | **implemented** | `ForceObligation`, transition/satisfaction, force-out vertical slices | covered by P1 acceptance matrix |
| R-05 tag after force dissolves | **implemented** | `TagArrivalRule`, force-dissolution/tag-arrival regressions | covered by P1 acceptance matrix |
| R-06 third out / scoring | **implemented** | batter-runner-before-first, force/time-play scoring, pending-run finalization | covered by P1 acceptance matrix |
| R-07 tag-up / appeal | **implemented** | fly-catch/tag-up vertical slice, appeal window/scoring, fourth-out handling | covered by P1 acceptance matrix |
| R-08 infield fly | **implemented** | `InfieldFlyRule` | P2/umpire layers still own physical/judgment inputs |

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


## Completion evidence

Gap-closing implementation:
- `20400587...` / `9f5b025e...`: pitch-count/foul semantics RED/GREEN;
- `fa50b660...` / `9967b050...`: infield-fly semantics RED/GREEN;
- `531f7a20...` / `90af2d0a...`: foul-fly + foul-count integration RED/GREEN;
- `af356a8b...` / `de18817b...`: third-out half-inning transition RED/GREEN;
- `cd32362f...` / `236c2394...`: P1 acceptance matrix and explicit post-force tag requirement;
- `83625eca...`: continuing foul-bunt type correction.

The P1 acceptance matrix now explicitly covers:
- four balls / three strikes;
- ordinary two-strike foul vs two-strike foul bunt;
- caught vs uncaught foul fly;
- force obligations and a one-out bases-loaded double-play scoring sequence;
- tag requirement after force dissolution;
- tag-up early departure / legal retouch;
- infield-fly batter out + batter-created-force removal;
- third-out half-inning transition.

GitHub Actions remains externally blocked before workflow commands execute. The latest completed verify evidence before this closeout still reports `steps=[]`; therefore repository GREEN is not claimed.

## P2 handoff

P1 owns the correct rule transformations and is now implementation-complete for the roadmap's core acceptance set.

P2 must now supply those rules with one canonical chronological plate-appearance stream:

```text
pitch
  -> take / swing
  -> ball / strike / foul / foul bunt / contact
  -> count transition OR live ball
  -> fielding + running
  -> play end
  -> CanonicalMatchState transition
```

Do not reopen P1 to implement a second pitch simulator.
