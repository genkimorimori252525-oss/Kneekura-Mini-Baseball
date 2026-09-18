# Defender Physical Movement Foundation Plan

**Status:** COMPLETE — implemented and verified on 2026-09-18.

**Goal:** Convert an individually selected `DefensiveIntent` into deterministic canonical defender movement without reintroducing a central post-contact planner.

**Source:** `2026-09-17-causal-contact-and-individual-defense-design.md` section 4.4: `DefensiveIntent -> movement / catch / throw / cover`.

**Architecture**

```text
DefensiveIntent
+ defender's perceived world
+ known static field landmarks
        ↓
local world-space movement target
        ↓
DefenderMotion
  acceleration / turning / braking / top speed
        ↓
constant-acceleration trajectory segments
        ↓
DefenderWorldState position / velocity
        ↓
future glove / tag / throw physical contact
```

**Permanent constraints**
- A ball-handler target comes from the defender's perceived ball estimate, never canonical ball truth.
- Base-cover targets come from static field landmarks, not a central assignment solver.
- Physical abilities are explicit motion parameters; `situationalAwareness` is not a movement parameter.
- Renderer cadence is irrelevant.
- Integration uses deterministic fixed substeps. The substep size is an explicit calibration input.
- Each substep is represented as a constant-acceleration trajectory segment so future continuous contact can consume the same motion truth.
- Do not feed accelerated defender motion to a constant-velocity contact solver as if it were linear.
- Initial foundation uses direct local movement toward a target; obstacle/path/intercept planning is deferred.

### Task 1: Resolve local DefensiveIntent targets

Create `DefensiveMovementTarget.ts` + tests.

- `base_cover` -> supplied static base landmark.
- `relay / backup / deep_coverage` -> target already carried by intent.
- `ball_handler` -> defender's perceived ball memory XZ estimate; no observed ball => no target.
- `hold` -> no target.
- API accepts no `CanonicalWorldSnapshot`.

### Task 2: Deterministic 2D defender motion

Create `DefenderMotion.ts` + tests.

State:
- tick
- position
- velocity

Parameters:
- ticksPerSecond
- maxIntegrationStepTicks
- accelerationMps2
- brakingMps2
- topSpeedMps
- arrivalRadiusMeters

Provide:
- `buildDefenderMotionTrajectory`
- `advanceDefenderMotion`
- `sampleDefenderMotionSegment`

Tests:
- acceleration from rest;
- top-speed cap;
- hold/braking;
- direction change has finite acceleration rather than instant velocity rotation;
- braking near target;
- result is invariant to renderer cadence because no presentation input exists.

### Task 3: First-base-cover movement vertical slice

Using the already implemented pitcher decision:
- same perception + plan selects `base_cover(1)`;
- high vs low situational awareness changes only decision tick;
- after decision, both use identical movement parameters and target;
- at a common later authoritative tick the earlier decision has physically progressed farther toward first base.

No central repair if the pitcher never perceived the cover need.

### Task 4: Canonical defender projection and Core API

Project physical motion into existing `DefenderWorldState.position / velocity` while preserving registered position and selected assignment.

Export target resolver and defender motion through `src/core/index.ts`, add regression tests, and run full `npm run verify`.

### Deferred follow-up

- moving-ball interception target prediction;
- route/path planning around other actors;
- acceleration-aware glove/tag continuous collision using the trajectory segments;
- throw-body mechanics;
- dive/jump body modes;
- calibration from baseball tracking data.


---

## Completion Evidence

Implemented:
- local `DefensiveIntent` -> world-space movement target resolution;
- perceived-ball-only targeting for `ball_handler`;
- deterministic 2D acceleration, finite turning, braking, and top-speed motion;
- explicit constant-acceleration trajectory segments for future continuous contact;
- first-base-cover decision timing -> physical position vertical slice;
- canonical `DefenderWorldState` projection;
- shared Core API exports.

Verification at implementation HEAD `27a0419004bf3e1959c86b1b05666331fe503f77`:
- `tsc --noEmit`: success
- Vitest: 42 test files passed
- Vitest: 196 tests passed
- P0 Core run: `35299472938` success
