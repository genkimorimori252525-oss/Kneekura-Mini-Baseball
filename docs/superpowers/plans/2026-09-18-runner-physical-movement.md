# Runner Physical Movement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Status:** Complete on `jolly/core-realism-2026-09-18`.

**Goal:** Implement the approved runner body-motion layer so runner intent becomes deterministic physical movement with reaction delay, acceleration, top speed, braking, retreat/reversal, base rounding, sliding, and exact physical base-touch timing.

**Architecture:** Runner decision remains outside this subsystem. `RunnerMotion` models signed progress along an explicit route; `RunnerRoute` maps route distance into world position/tangent and supports line and circular-arc segments for authoritative base rounding. `RunnerBodyContact` derives a physical foot/hand contact point instead of treating the runner center as the touch point. `RunnerBaseTouch` resolves the first base contact from analytic motion segments and route/base geometry. `RunnerWorldProjection` exposes only canonical world position/velocity to `CanonicalWorldSnapshot` consumers.

**Tech Stack:** TypeScript, Vitest, integer-microsecond Core clock, `Vec2`, `quantizeEventTick`, existing `BaseTouch` geometry conventions.

**Spec:** `docs/superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md` section 4, especially 4.1-4.5.

## Global Constraints

- Preserve `Canonical World -> Runner Perceived World -> Runner Decision -> Runner Intent -> Physical Movement`.
- No central omniscient baserunning AI is introduced here.
- Canonical movement covers reaction delay, acceleration, top speed, braking, base rounding, direction reversal / retreat, slide initiation, and base-touch timing.
- Player ability acts through intermediate physical/calibration quantities rather than direct success probability.
- Canonical event time remains integer microseconds and does not depend on renderer cadence.
- No stride-by-stride muscular or skeletal simulation; use a compact calibrated body model.
- Existing `findBaseTouchTick` remains available for truly linear constant-velocity physical contact trajectories.
- Accelerated/curved runner trajectories are never passed to legacy `findBaseTouchTick` as if they were linear.
- Calibration values are explicit inputs; fixture values in tests are not claimed as final real-world calibration.

## Implemented improvements discovered during execution

1. **Shared analytic trajectory source:** `RunnerMotion` now exposes deterministic piecewise trajectory segments through `buildRunnerMotionTrajectory`. `advanceRunnerMotion` and `RunnerBaseTouch` share those segments instead of duplicating movement equations.
2. **Canonical signed-zero normalization:** physical contact/world velocity projections normalize JavaScript `-0` to canonical `0`, preventing representation-only snapshot/test differences.
3. **Trajectory-aware base touch:** accelerated straight motion and curved base-rounding motion resolve exact first contact analytically rather than using display frames or a constant-velocity approximation.
4. **Snapshot boundary kept narrow:** richer runner state (`routeDistanceMeters`, drive direction, body mode) remains internal to the runner subsystem; `CanonicalWorldSnapshot` still receives only `playerId`, `position`, and `velocity`.

---

### Task 1: Deterministic signed runner kinematics — COMPLETE

**Files:** `RunnerMotion.ts`, `RunnerMotion.test.ts`

- [x] Write RED tests for reaction delay and acceleration.
- [x] Verify RED because `RunnerMotion` did not exist.
- [x] Implement reaction-gated deterministic integration.
- [x] Add top-speed cap, braking, and reversal tests.
- [x] Implement exact piecewise braking/reversal and verify GREEN.
- [x] Commit implementation.

Implemented behavior:

- Before a newly issued intent reaches its reaction tick, the previous physical drive remains active.
- `advance` accelerates toward positive top speed.
- `retreat` brakes existing forward speed to zero before accelerating backward.
- `hold` brakes to zero without overshooting into reverse motion.
- Crossing acceleration/top-speed/stop boundaries inside an interval is handled piecewise rather than rounded to the external step boundary.

---

### Task 2: Route geometry with explicit base-rounding arcs — COMPLETE

**Files:** `RunnerRoute.ts`, `RunnerRoute.test.ts`

- [x] Write RED line-route tests.
- [x] Verify RED because `RunnerRoute` did not exist.
- [x] Implement line segments and validation.
- [x] Add analytic circular-arc/base-rounding tests.
- [x] Implement circular arcs and verify GREEN.
- [x] Commit implementation.

Implemented behavior:

- `RunnerRoute` is a continuous sequence of line and circular-arc segments.
- Route position is addressed by authoritative scalar distance along the route.
- Sampling returns world position plus the unit tangent for increasing route distance.
- Empty routes, zero-length lines, invalid arcs, and discontinuities are rejected.
- Sampling beyond the finite authoritative route throws instead of silently clamping.

---

### Task 3: Slide initiation and physical touch point — COMPLETE

**Files:** `RunnerMotion.ts`, `RunnerMotion.test.ts`, `RunnerBodyContact.ts`, `RunnerBodyContact.test.ts`

- [x] Write RED slide tests.
- [x] Implement reaction-gated slide transition and verify GREEN.
- [x] Write RED physical foot/hand contact tests.
- [x] Implement compact body contact projection and verify GREEN.
- [x] Diagnose and fix signed-zero canonicalization found by regression tests.
- [x] Commit implementation.

Implemented behavior:

- Runner body mode is `upright | sliding`.
- `slide` uses the same reaction gate as other intents.
- Sliding applies its own calibrated deceleration and never reverses travel after stopping.
- Upright running projects a leading `foot` contact point.
- Sliding projects a leading `hand` contact point.
- The lead distance is an explicit calibration input, not a hard-coded limb length.
- Retreat projects the contact point behind increasing route distance, consistent with actual travel direction.
- Physical contact velocity follows the route tangent at the contact point.

---

### Task 4: Exact base touch for accelerated and curved runner trajectories — COMPLETE

**Files:** `RunnerBaseTouch.ts`, `RunnerBaseTouch.test.ts`, shared trajectory support in `RunnerMotion.ts`

- [x] Write RED regression proving the legacy constant-velocity ray is insufficient during acceleration.
- [x] Correct the test fixture so RED is caused only by missing `RunnerBaseTouch`.
- [x] Implement deterministic analytic trajectory segmentation shared with `RunnerMotion`.
- [x] Add RED curved/base-rounding touch coverage.
- [x] Implement line/arc route-to-base intersections plus analytic distance-to-time inversion.
- [x] Run full verification and confirm legacy `BaseTouch` tests remain unchanged and green.
- [x] Commit implementation.

Implemented event pipeline:

```text
RunnerMotionState + RunnerIntent
        ↓
buildRunnerMotionTrajectory
        ↓
monotonic analytic motion segments
        ↓
physical foot/hand route-distance path
        ↓
line / circle-arc intersection with finite oriented base
        ↓
first route-distance contact in travel order
        ↓
solve s = s0 + v0*t + 0.5*a*t²
        ↓
quantizeEventTick
        ↓
authoritative base-touch microsecond tick
```

No renderer frame order, display cadence, unbounded iterative solver, or fake constant world-space velocity is used.

---

### Task 5: Canonical projection and shared Core API — COMPLETE

**Files:** `RunnerWorldProjection.ts`, `RunnerWorldProjection.test.ts`, `src/core/index.test.ts`, `src/core/index.ts`

- [x] Write RED canonical projection tests for straight and curved routes.
- [x] Implement projection and verify GREEN.
- [x] Add stable signed-zero regression coverage for canonical velocity.
- [x] Add RED Core API export test.
- [x] Export runner modules through the shared Core API.
- [x] Run full regression verification.
- [x] Commit implementation.

Shared Core now exposes the runner movement boundary, including:

```text
advanceRunnerMotion
sampleRunnerRoute
sampleRunnerPhysicalTouchPoint
findRunnerBaseTouchTick
projectRunnerWorldState
```

`buildRunnerMotionTrajectory` is also available through the runner module export for later physical integrations that need the exact same analytic motion segmentation.

## Completion evidence

The implementation was developed through explicit RED -> GREEN cycles. The code HEAD immediately before this documentation closeout was `b99d9ac452968536c78031e670cc5ade840619b0`, where `npm run verify` completed successfully with TypeScript typecheck passing and 27 Vitest files / 109 tests passing.

A final full regression must also pass on the documentation-closeout HEAD before this phase is considered closed.
