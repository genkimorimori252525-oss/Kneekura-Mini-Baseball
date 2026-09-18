# P3 Ratings / Physical Profile Acceptance Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P3 — ratings / physical profile foundation.

## P3 acceptance map

| Requirement | State | Current evidence | Boundary / note |
| --- | --- | --- | --- |
| normalized internal defensive ratings schema | **implemented** | `DefensiveRatings` | all ratings validated in [0, 1] |
| public vs hidden/internal ratings boundary | **implemented** | `DefensiveRatingProfile`, `PublicDefensiveRatings` | public defense summary is not consumed by Core physics |
| explicit position suitability for all 9 defensive positions | **implemented** | `PositionSuitabilityMap` | effect on role-specific execution is deferred to P4/P5 context to avoid double counting |
| firstStep separation | **implemented** | `DefenderFirstStepTiming`, rated adapter | changes movement-start tick only |
| acceleration separation | **implemented** | rated `DefenderMotionParameters.accelerationMps2` | does not change top speed, catch, or decision timing |
| battedBallRead separation | **implemented** | `BattedBallReadSkill` | changes perceived ball position/velocity interpretation, not true BallFlight |
| routeEfficiency separation | **implemented** | `DefenderRoutePlan` | changes path geometry / path length, not max speed |
| catching separation | **implemented** | existing catch execution + retention skill adapters | changes target error and retention capacity, not reach distance or movement speed |
| transfer separation | **implemented** | `BallTransferTiming` | changes throw-ready tick after secured possession |
| armStrength separation | **implemented** | `ThrowLaunch` | changes 3D release speed magnitude |
| throwingAccuracy separation | **implemented** | `ThrowLaunch` | changes aimed target error, not speed |
| situationalAwareness separation | **implemented** | existing `DefensiveDecisionTiming` rated adapter | changes decision delay only |
| tagSkill separation | **implemented** | `TagActionTiming` | changes tag-action start delay only |
| PlayerPhysicalProfile foundation | **implemented** | `PlayerPhysicalProfile` | height-only first slice |
| body-size -> physical reach calibration | **implemented** | `DefenderPhysicalProfileCalibration` | changes body origin / leg / glove / tag reach only |
| Presentation size separate from Core physics | **implemented** | `PlayerDotProfile` | default 9/10/11px tiers; pixel changes cannot alter Core calibration |
| single-rating effect isolation | **implemented source acceptance** | `P3DefensiveRatingSeparationAcceptance.test.ts` | CI execution externally blocked |

## Physical-profile boundary

The initial physical profile intentionally contains only:

```ts
type PlayerPhysicalProfile = {
  heightMeters: number;
}
```

Reference calibration height:

```text
1.80 m
```

This is a game calibration reference, not a real-league statistical claim.

At the reference height, pre-P3 Core baseline values are reproduced exactly.

Height scales only:

- body origin height;
- maximum leg reach;
- maximum glove reach;
- maximum tag reach.

It does not directly scale:

- running top speed;
- acceleration;
- reaction;
- perception;
- catching;
- throw speed;
- success probability.

Independent `armSpanMeters` / `legLengthMeters` remain deferred until a demonstrated need exists.

## Rating causality map

```text
firstStep
  -> movement start timing

acceleration
  -> movement acceleration

battedBallRead
  -> perceived batted-ball position/velocity interpretation error

routeEfficiency
  -> path geometry / path length

catching
  -> glove target execution error
  -> physical catch-retention capacity/dissipation

transfer
  -> throw-ready timing

armStrength
  -> throw release speed

throwingAccuracy
  -> physical aimed target error

situationalAwareness
  -> role/decision timing

tagSkill
  -> tag-action start timing
```

No rating above directly changes an out/safe/catch success percentage.

## Position suitability boundary

`positionSuitability` is validated for all nine registered defensive positions and can be queried for the current registered position.

P3 intentionally does **not** multiply it into every other defensive rating.

That would risk counting the same limitation multiple times before the engine knows whether the player is:

- reading a batted ball;
- covering a base;
- acting as relay;
- backing up;
- handling a double-play transfer;
- playing an unfamiliar geometric region.

P4/P5 will apply suitability at the concrete alignment/role/task boundary where its meaning is explicit.

## Public rating boundary

`publicDefenseRating` exists for explanation/UI and does not drive physical execution.

The public view exposes:

- defense summary;
- arm strength;
- position suitability.

The internal source of truth remains the independent ratings schema.

Changing only the public defense summary cannot alter the rated motion output.

## Deterministic execution

Randomness is used only where a physical/estimation error must be sampled:

- catch execution target error;
- batted-ball read estimate error;
- throw aimed-target error.

These use deterministic Core RNG streams. They are not success/failure rolls.

## Presentation boundary

Mini player dot size is derived separately:

- height scale < 0.95 -> 9px;
- 0.95 <= scale < 1.05 -> 10px;
- scale >= 1.05 -> 11px.

Presentation thresholds and pixel sizes can be recalibrated without changing:

- `PlayerPhysicalProfile`;
- Core reach calibration;
- collision geometry;
- canonical event outcomes.

## Representative source acceptance

- `src/core/model/PlayerPhysicalProfile.test.ts`
- `src/core/model/DefensiveRatings.test.ts`
- `src/core/model/DefensiveRatingProfile.test.ts`
- `src/core/sim/fielding/DefenderPhysicalProfileCalibration.test.ts`
- `src/core/sim/fielding/PlayerPhysicalProfileIntegration.test.ts`
- `src/core/sim/fielding/P3DefensiveRatingSeparationAcceptance.test.ts`
- `src/presentation/mini/PlayerDotProfile.test.ts`

## Known deferred work that does not reopen P3 foundation

- position-suitability effects at concrete P4/P5 roles;
- independent arm-span / leg-length measurements;
- public rating display scale beyond normalized internal values;
- player data authoring/import;
- additional physical throwing aerodynamics after launch;
- richer tag hand/pose execution after tag-action start.

These should reuse the P3 schema and intermediates rather than introducing direct outcome bonuses.

## P4 handoff

P4 should now build:

1. true batter tendencies separate from defensive knowledge;
2. `ScoutingEstimate` with uncertainty/sample age;
3. arbitrary-coordinate `DefensiveAlignment`;
4. manager candidate-alignment comparison;
5. position suitability applied only when evaluating the actual assigned defensive role/region.

P4 must not read true future batted-ball outcomes or alter post-alignment player physics based on manager skill.

## CI caveat

GitHub Actions has repeatedly terminated before workflow steps execute with `steps=[]`.

Repository GREEN is not claimed until the verify job actually runs commands.
