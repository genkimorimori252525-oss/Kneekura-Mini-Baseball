# Original rolling motion to venue legal coverage

This is a bounded area 4 connection from the [original nine-area scope, §5](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画) and the [current remaining-work entry](2026-10-09-nonvisual-nine-area-status.md). The starting commit is `65de91a31b76bdce4feed134f5c794196de715b8`, with source tree `3a62bf47d88f7465605367d78be95d30de4afe67`.

## Existing authority

- [World-first architecture](../game-design/05-world-first-live-ball-architecture.md) keeps physical movement ahead of legal interpretation. The [runtime](../game-design/06-world-first-runtime-contracts.md) and [adjudication](../game-design/07-world-first-adjudication-contracts.md) contracts retain the distinction between physical facts and official decisions.
- `BallWorldContinuation.ts` already owns rolling acceleration from the accepted `groundRollingDecelerationMps2`, exact physical stop time, and a separate subsequent resting segment. Zero deceleration means continued motion, with no fabricated stop.
- `BattedWorldFieldMotion.ts` already executes each row only through its first physical boundary. `BattedWorldContinuation.ts` preserves the stop cursor and applies any original ground/rebound response before the next piece.
- `SamePlateAppearanceVenueLegalCoverage.ts` reads the authenticated original field prefix and accepted `BattedVenueLegalCoveragePolicy` binding. `BallWorldVenueLegalCoverage.ts` certifies complete sphere containment in supplied legal interiors; an endpoint alone cannot certify an interval.

## Connection

The physical owner's existing phase, acceleration and stop calculation is exposed as `ballWorldFreeMotionCurve` and used by both execution and the legal adapter. Its arithmetic and accepted parameters are unchanged. The adapter can now supply the actual rolling coefficient instead of always leaving it unknown.

One legal segment still corresponds to one original field row. A rolling-stop row is the last decelerating piece; its next resting row has zero velocity and acceleration. The adapter requires the original free-motion phase and refuses polynomial coverage beyond the physical stop. Carried/capture motion keeps its original glove coefficient. Field references, appeal-throw segment indexes, historical cuts and input bytes remain unchanged.

This adds no home-run, award, roof, interference or new venue rule, no physical calibration/default, and no play-end inference. Unknown legal space, missing physical phase and unsupported curves remain unresolved. The approved original owners above are the authority; design document 32 is not used.

## Bounded verification

The adapter regressions use real Core adoption/checkpoint execution with a small structural authenticated-pair seam; they do not claim a full Native SQLite admission or whole game.

- Continuous rolling → stop → resting coverage in accepted in-play and out-of-play interiors, including a nonzero origin tick.
- Zero-deceleration continuation, retained earlier cut, unknown legal space and refusal of a missing-phase or beyond-stop curve.
- Existing exact physical continuation and legal-containment tests, including the archived free/field/accelerated output digest.

Focused command (direct Vitest invocation, without catalog generation):

```sh
node node_modules/vitest/vitest.mjs run src/host/world/SamePlateAppearanceVenueLegalCoverage.test.ts src/core/sim/ball/BallWorldExactContinuation.test.ts src/core/rules/BallWorldVenueLegalCoverage.test.ts --maxWorkers=1 --minWorkers=1
```

Node 26 focused result: **3 files / 42 tests passed**, exit 0, 4.78 seconds. Before the adapter connection, the three added positive rolling cases failed with `pending` instead of `complete`. All 18 protected file blobs match the preserved baseline; `git diff --check` is clean.

Full compiler, whole/archive suite, long Native game, home-PC CI, merge and deploy are outside this authoring pass. Parent integration retains the consolidated review and verification gates.

## Review correction: unchanged physical points

The Native `stable()` owner in `SamePlateAppearancePhysicalFieldActionFromSqlite.ts` copies the preceding field for no-advance observations and decisions. After ground contact, that retained World still describes airborne arrival while its cursor already contains the rolling response. Requiring matching phases on this zero-duration row incorrectly made the legal prefix pending.

When both the exact elapsed time and complete field value are unchanged, the adapter now uses the original endpoint as a point segment. It does not reconstruct motion across this row. Positive-duration rows retain their physical phase and rolling-stop checks.

The focused ground-contact → observation → decision → rolling → stop → resting regression first failed at the no-advance historical cut, then passed. The final adapter-only run passed **1 file / 15 tests**, exit 0, 4.10 seconds. The scenario checks both the earlier cut and complete later prefix, including a deserialized unchanged field. All 18 protected blobs still match and `git diff --check` remains clean. No additional broad gate was run for this correction.
