# Pitching Physics Architecture v1 Freeze

Date: 2026-09-21

Status: **architecture frozen; calibration still open**

Version:

```text
pitching-physics-architecture-v1
```

## 1. Frozen causal graph

The authoritative pitching dependency is now:

```text
manager macro intent
        ↓ bias
catcher lead
        ↓
pitcher accepts / overrides
        ↓
stable pitcher-owned pitchSkillId
+ pitcher-specific coarse-call response
        ↓
learned release template
+ deterministic execution variance
        ↓
finger impulse / release mechanics
        ↓
release velocity
release spin vector
seam/material orientation
        ↓
drag + Magnus + gravity + wind
        ↓
physical pitch trajectory
        ↓
batter anticipation / recognition timing
        ↓
physical swing / take geometry
        ↓
canonical pitch adjudication
```

No pitch-type name is allowed to feed backward into this graph.

## 2. Frozen architectural rules

1. Human-readable pitch names are downstream metadata only.
2. Manager mode never requires exact per-pitch coordinates.
3. Catcher calls are coarse plans, not guaranteed outcomes.
4. Pitcher personality may change the final call but never adds a direct success/failure modifier.
5. Batter anticipation may affect recognition/timing but never directly creates a miss or hit.
6. Per-pitch randomness enters before flight through deterministic Core RNG streams.
7. Seam orientation is authoritative state.
8. Explicit finite-element ball/bat/finger deformation remains outside Canonical Core.
9. Mini/Natural remain observers of the same canonical state.
10. Existing rule adjudication remains the single authoritative rules path.

## 3. Calibration remains open

Architecture freeze does **not** mean numerical calibration is finished.

These inputs may still receive versioned calibration updates without changing the v1 causal graph:

- drag/lift coefficients;
- spin decay;
- pitcher coarse-call -> release-space response;
- release repeatability distributions;
- batter anticipation -> recognition-delay timing;
- named-pitch movement registry;
- empirical swing/contact timing validation.

## 4. Explicit v1 force-model exclusions

The following are **not approximated by hidden bonuses** in v1:

- seam-shifted-wake aerodynamic force;
- knuckleball-specific unsteady seam force;
- full upstream arm/hand/tendon biomechanics.

They may be added later only as explicit upstream physical models with a new or extended versioned contract.

## 5. Closure decision

The pitching **architecture** is frozen at v1.

The pitching **calibration** remains open until its validation gates are satisfied.

Baseball physics as a whole remains open because bat-ball collision calibration and ground/wall bounce-skid-roll physics are still active work.
