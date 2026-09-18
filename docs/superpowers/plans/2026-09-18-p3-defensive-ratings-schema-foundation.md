# P3 Defensive Ratings Schema Foundation — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

## Purpose

Create one validated source of truth for the defensive internal abilities already described by the game-design documents.

All internal abilities use normalized `[0, 1]` values.

A rating is not itself an outcome probability.

## Schema

```ts
DefensiveRatings {
  positionSuitability
  firstStep
  acceleration
  battedBallRead
  routeEfficiency
  catching
  transfer
  armStrength
  throwingAccuracy
  situationalAwareness
  tagSkill
}
```

## Constraints

- validate each rating exactly once at the model boundary;
- no aggregate defense score is consumed by physics;
- no field is interpreted as direct out/catch/safe probability;
- movement top speed remains separate from acceleration;
- catching does not change reach distance;
- situational awareness changes decision timing/information use, not movement physics;
- physical body size remains in `PlayerPhysicalProfile`, not ratings;
- position suitability is explicit for all nine registered defensive positions.

## Initial adapters

Connect only where Core already owns a meaningful intermediate:

1. `acceleration` -> defender acceleration calibration;
2. `catching` -> existing CatchExecution/CatchRetention ability inputs;
3. `situationalAwareness` -> existing DefensiveDecisionTiming ability input.

Do not invent transfer/arm/accuracy/tag formulas merely to claim wiring completeness. Add those when the corresponding physical intermediate is implemented.
