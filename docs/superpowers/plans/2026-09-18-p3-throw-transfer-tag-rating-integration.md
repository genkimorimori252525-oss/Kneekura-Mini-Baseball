# P3 Throw / Transfer / Tag Rating Integration — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

## Goal

Wire four remaining defensive ratings into explicit physical/timing intermediates:

- transfer -> throw-ready time;
- armStrength -> release speed;
- throwingAccuracy -> aimed throw target error;
- tagSkill -> tag-action start delay.

## Causal path

```text
secured catch
  -> transfer timing
  -> throw-ready tick

throw decision + target
  -> armStrength -> launch speed
  -> throwingAccuracy -> aimed target point
  -> physical launch velocity
  -> existing ball/reception physics

secured possession near runner
  -> tagSkill -> tag-action start tick
  -> future tag primitive motion
  -> existing TagContact solver
```

## Constraints

- no direct out/safe probability;
- armStrength does not change transfer time or aim error;
- throwingAccuracy does not change launch speed;
- transfer does not change catch tick;
- tagSkill does not change runner motion or defender body speed;
- deterministic RNG only affects explicit target error, not a success roll;
- exact release timing remains owned by `findThrowReleaseTick` once a hand/body throwing model supplies the constraint boundary.
