# P3 Player Physical Profile Foundation — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

**Parent roadmap:** P3 — ratings / physical profile foundation.

## Purpose

Introduce player body size as a Core calibration input without turning height into a direct outcome bonus.

The first slice intentionally starts with **height only**.

`armSpanMeters` / `legLengthMeters` are deferred until tests show height-only scaling cannot represent an independent physical difference.

## Architecture

```text
PlayerPhysicalProfile
  heightMeters
        ↓
reference-height scale
        ↓
DefenderPhysicalReachCalibration
  bodyOriginHeightMeters
  maximumLegReachMeters
  maximumGloveReachMeters
  maximumTagReachMeters
        ↓
existing Core geometry / reach solvers
        ↓
physical contact timing / reachability
```

No probability bonus is produced by this layer.

## Reference principle

The current Core reach/body values remain the **reference-size baseline**.

A reference-height player must reproduce those values exactly.

This avoids silently retuning existing physics while P3 is introduced.

Initial design reference:

- `REFERENCE_PLAYER_HEIGHT_METERS = 1.80`

This is a **game calibration reference**, not a claim about a real league's measured average height.

## Permanent constraints

- height affects meaningful physical intermediate values only;
- height does not directly modify catch/out/safe/success probability;
- maximum speed, acceleration, perception, decision quality, catching skill, throwing skill remain separate ratings;
- Presentation dot size is derived separately and is never fed back into Core collision/reach;
- Core uses meters; Presentation uses pixels;
- changing Presentation dot-size tier thresholds must not change canonical results;
- reference-height profile reproduces current baseline values exactly;
- same profile + same baseline gives deterministic calibration;
- optional arm span / leg length may be added later without changing the public height contract.

## Task 1: PlayerPhysicalProfile

Create a minimal validated schema:

```ts
type PlayerPhysicalProfile = {
  heightMeters: number;
}
```

## Task 2: Reach calibration

Create a pure adapter that scales existing baseline physical dimensions:

- body origin height;
- maximum leg reach;
- maximum glove reach;
- maximum tag reach.

Do **not** scale:
- movement speed;
- acceleration;
- reaction delay;
- catching probability;
- throwing outcome.

## Task 3: Existing physics integration regressions

Show that changing only height can change:
- whether a base-foot target is inside maximum leg reach;
- whether a perceived glove target is inside maximum glove reach;

while leaving the corresponding speed/acceleration limits unchanged.

## Task 4: Mini Presentation size boundary

Map the same physical profile to small Presentation-only dot-size tiers around the current 10px reference.

Initial candidate:
- small: 9px;
- reference: 10px;
- large: 11px.

Thresholds remain a Presentation calibration and must not become Core geometry.

## Task 5: Acceptance

Require:
- reference profile -> baseline values unchanged;
- taller profile -> larger physical reach/origin;
- shorter profile -> smaller physical reach/origin;
- no direct success/probability fields exist in the calibration output;
- changing Mini dot-size mapping cannot alter Core calibration or canonical state.
