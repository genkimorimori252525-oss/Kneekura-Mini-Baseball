# Runner Physical Movement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved runner body-motion layer so runner intent becomes deterministic physical movement with reaction delay, acceleration, top speed, braking, retreat/reversal, base rounding, sliding, and exact physical base-touch timing.

**Architecture:** Runner decision remains outside this subsystem. `RunnerMotion` models signed progress along an explicit route; `RunnerRoute` maps route distance into world position/tangent and can contain line and circular-arc segments for base rounding. A compact body-contact layer derives an effective foot/hand contact point from route progress, and a trajectory-aware base-touch resolver later maps that physical contact path to an exact authoritative tick without assuming constant world-space velocity.

**Tech Stack:** TypeScript, Vitest, existing integer-microsecond Core clock, `Vec2`, `quantizeEventTick`, existing `BaseTouch` geometry conventions.

**Spec:** `docs/superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md` section 4, especially 4.1-4.5.

## Global Constraints

- Preserve `Canonical World -> Runner Perceived World -> Runner Decision -> Runner Intent -> Physical Movement`.
- No central omniscient baserunning AI is introduced here.
- Minimum canonical runner movement features are reaction delay, acceleration, top speed, braking, base rounding, direction reversal / retreat, slide initiation, and base-touch timing.
- Player ability must affect intermediate physical quantities rather than direct success probability.
- Canonical event time remains integer microseconds and must not depend on renderer cadence.
- Do not simulate stride-by-stride muscles or skeletal dynamics; use a compact calibrated physical model.
- Existing `findBaseTouchTick` remains available for linear physical contact-point trajectories.
- **Design improvement:** accelerated/curved runner trajectories must not be passed to the existing constant-velocity `findBaseTouchTick` as if they were linear. A route/trajectory-aware resolver is required before final runner-to-base integration.
- Calibration values are explicit inputs; this plan does not claim real-world calibration constants.

---

### Task 1: Deterministic signed runner kinematics

**Files:**
- Create: `src/core/sim/running/RunnerMotion.ts`
- Create/Test: `src/core/sim/running/RunnerMotion.test.ts`

**Interfaces:**

```ts
export type RunnerDriveDirection = -1 | 0 | 1;

export type RunnerMotionState = Readonly<{
  tick: number;
  routeDistanceMeters: number;
  speedMps: number; // signed: positive=advance, negative=retreat
  driveDirection: RunnerDriveDirection;
}>;

export type RunnerMotionIntent = Readonly<{
  kind: 'advance' | 'retreat' | 'hold';
  issuedTick: number;
}>;

export type RunnerMotionParameters = Readonly<{
  ticksPerSecond: number;
  reactionDelayTicks: number;
  accelerationMps2: number;
  brakingMps2: number;
  topSpeedMps: number;
}>;

export const advanceRunnerMotion = (
  state: RunnerMotionState,
  intent: RunnerMotionIntent,
  deltaTicks: number,
  parameters: RunnerMotionParameters,
): RunnerMotionState;
```

- [ ] **Step 1: Write failing tests for reaction delay and acceleration**

Use explicit fixture values: 1,000,000 ticks/s, 100,000 tick reaction delay, 4 m/s^2 acceleration, 4 m/s^2 braking, 8 m/s top speed. Starting at rest, an advance intent issued at 1,000,000 and advanced by 200,000 ticks must spend 0.1 s waiting and 0.1 s accelerating, ending at 0.4 m/s and 0.02 m progress.

Also prove that before a new intent activates, the previous `driveDirection` remains active rather than forcing an artificial coast.

- [ ] **Step 2: Run verification and confirm RED**

Run: `npm run verify`

Expected: typecheck/test failure because `RunnerMotion` does not exist.

- [ ] **Step 3: Implement reaction-gated deterministic integration**

Validate safe integer ticks, finite state values, positive `ticksPerSecond`, non-negative delay, positive acceleration/braking/top speed, and `|speedMps| <= topSpeedMps` within floating tolerance.

Before `intent.issuedTick + reactionDelayTicks`, continue the state's existing `driveDirection`. At activation, map `advance -> +1`, `retreat -> -1`, `hold -> 0`.

For an active drive in the same direction as current motion, accelerate toward signed top speed. When the mathematical top-speed boundary occurs inside the interval, integrate acceleration until the boundary and cruise for the remainder.

- [ ] **Step 4: Add failing tests for top-speed cap, braking, and reversal**

Required fixtures:

```text
accelerate from rest for 3 s at 4 m/s^2 with 8 m/s cap
=> 2 s acceleration (8 m), 1 s cruise (8 m), total 16 m, final 8 m/s

hold from +6 m/s for 1 s at 3 m/s^2 braking
=> +3 m/s, +4.5 m displacement

reverse from +4 m/s with 4 m/s^2 braking/acceleration for 2 s
=> stop after 1 s at +2 m displacement, accelerate backward for 1 s,
   final -4 m/s and route distance returns to start
```

- [ ] **Step 5: Implement exact piecewise braking/reversal and verify GREEN**

Opposite-direction drive must first brake signed speed to zero, then accelerate in the new direction using only the remaining interval. `hold` brakes to zero and must never overshoot into reverse motion.

Run: `npm run verify`

Expected: all tests pass.

- [ ] **Step 6: Commit**

Commit message: `feat: add deterministic runner kinematics`

---

### Task 2: Route geometry with explicit base-rounding arcs

**Files:**
- Create: `src/core/sim/running/RunnerRoute.ts`
- Create/Test: `src/core/sim/running/RunnerRoute.test.ts`

**Interfaces:**

```ts
export type RunnerRouteSegment =
  | Readonly<{ kind: 'line'; start: Vec2; end: Vec2 }>
  | Readonly<{
      kind: 'arc';
      center: Vec2;
      radiusMeters: number;
      startAngleRadians: number;
      sweepRadians: number;
    }>;

export type RunnerRoute = Readonly<{
  segments: readonly RunnerRouteSegment[];
}>;

export type RunnerRouteSample = Readonly<{
  position: Vec2;
  tangent: Vec2; // unit tangent for increasing route distance
  segmentIndex: number;
  distanceMeters: number;
}>;

export const getRunnerRouteLength = (route: RunnerRoute): number;
export const sampleRunnerRoute = (route: RunnerRoute, distanceMeters: number): RunnerRouteSample;
```

- [ ] **Step 1: Write failing line-route tests**

Prove exact total length, position, and unit tangent on a straight route. Sampling outside `[0, routeLength]` must throw rather than silently clamp canonical motion.

- [ ] **Step 2: Run verification and confirm RED**

Run: `npm run verify`

Expected: missing `RunnerRoute` module.

- [ ] **Step 3: Implement line segments and validation**

Reject zero-length lines, non-finite coordinates, empty routes, and discontinuities between adjacent route segments larger than `1e-9 m`.

- [ ] **Step 4: Add failing arc/base-rounding tests**

Use a quarter-circle arc and require sampled midpoint position and tangent to match analytic circle geometry. Add a line -> arc -> line route proving continuity through a rounded base path.

- [ ] **Step 5: Implement circular arcs and verify GREEN**

Arc length is `radiusMeters * abs(sweepRadians)`. Tangent orientation follows sweep sign. No Bezier or renderer-only approximation is authoritative.

Run: `npm run verify`

Expected: all tests pass.

- [ ] **Step 6: Commit**

Commit message: `feat: model runner routes and base rounding`

---

### Task 3: Slide initiation and physical touch point

**Files:**
- Modify: `src/core/sim/running/RunnerMotion.ts`
- Modify/Test: `src/core/sim/running/RunnerMotion.test.ts`
- Create: `src/core/sim/running/RunnerBodyContact.ts`
- Create/Test: `src/core/sim/running/RunnerBodyContact.test.ts`

**Interfaces:**

Extend motion state/intent with:

```ts
export type RunnerBodyMode = 'upright' | 'sliding';

// RunnerMotionState gains bodyMode.
// RunnerMotionIntent gains kind 'slide'.
// RunnerMotionParameters gains slideDecelerationMps2.
```

`slide` activates after the same reaction gate, preserves the sign of current travel, changes `bodyMode` to `sliding`, and applies calibrated slide deceleration without reversing direction.

Body contact projection:

```ts
export type RunnerBodyContactParameters = Readonly<{
  uprightLeadMeters: number;
  slideLeadMeters: number;
}>;

export type RunnerPhysicalTouchPoint = Readonly<{
  kind: 'foot' | 'hand';
  routeDistanceMeters: number;
  position: Vec2;
  velocity: Vec2;
}>;

export const sampleRunnerPhysicalTouchPoint = (
  motion: RunnerMotionState,
  route: RunnerRoute,
  parameters: RunnerBodyContactParameters,
): RunnerPhysicalTouchPoint;
```

- [ ] **Step 1: Write failing slide tests**

Prove slide does not begin before reaction delay, begins at activation, decelerates without reversing, and exposes `bodyMode='sliding'`.

- [ ] **Step 2: Implement slide transition and verify GREEN**

Run: `npm run verify`.

- [ ] **Step 3: Write failing physical-contact tests**

Require upright mode to emit a `foot` point and sliding mode to emit a `hand` point. The point must be sampled at `routeDistanceMeters + sign(speedMps) * leadMeters`, not at the runner center. World velocity is route tangent times signed runner speed at the contact-point route distance.

- [ ] **Step 4: Implement compact body contact projection and verify GREEN**

All lead distances are calibration inputs and must be non-negative. Do not hard-code human limb lengths.

- [ ] **Step 5: Commit**

Commit message: `feat: add runner slide and physical base contact point`

---

### Task 4: Exact base touch for accelerated and curved runner trajectories

**Files:**
- Create: `src/core/sim/running/RunnerBaseTouch.ts`
- Create/Test: `src/core/sim/running/RunnerBaseTouch.test.ts`
- Reuse: `src/core/sim/running/BaseTouch.ts`

**Interfaces:**

This task must not approximate an accelerated or curved path as one constant-velocity ray. It produces:

```ts
export const findRunnerBaseTouchTick = (
  start: RunnerMotionState,
  intent: RunnerMotionIntent,
  route: RunnerRoute,
  base: BaseTouchRegion,
  deltaTicks: number,
  motionParameters: RunnerMotionParameters,
  bodyParameters: RunnerBodyContactParameters,
): number | null;
```

- [ ] **Step 1: Write failing regression proving legacy linear assumption is insufficient**

Construct an accelerating runner where start-velocity ray casting returns null or a different tick, while the physical contact path reaches the base inside the interval. Require the new resolver to return the correct authoritative tick.

- [ ] **Step 2: Implement deterministic trajectory segmentation**

Split motion at every physical regime change already defined by `RunnerMotion`: intent activation, stop/reversal, top-speed cap, and slide transition. Each segment must have monotonic route distance.

- [ ] **Step 3: Write failing curved/base-rounding touch test**

Use a route arc intersecting an oriented finite base region and require the first physical foot/hand entry tick rather than center entry.

- [ ] **Step 4: Implement route/base intersection plus distance-to-tick inversion**

For line route segments, use oriented slab intersection. For circular arcs, intersect the circle with the four finite base edges, filter candidates to the authoritative arc sweep, include an already-inside start candidate, and choose the first candidate in travel order. Convert candidate contact-route distance back to the first authoritative tick by solving the segment's scalar kinematic equation and applying `quantizeEventTick`.

Do not use renderer frame order, coarse display steps, or unbounded iterative solvers.

- [ ] **Step 5: Run full verification and confirm GREEN**

Run: `npm run verify`.

Expected: all tests pass and the legacy `findBaseTouchTick` tests remain unchanged.

- [ ] **Step 6: Commit**

Commit message: `feat: resolve exact runner base touch on physical trajectories`

---

### Task 5: Canonical projection and shared Core API

**Files:**
- Create: `src/core/sim/running/RunnerWorldProjection.ts`
- Create/Test: `src/core/sim/running/RunnerWorldProjection.test.ts`
- Modify: `src/core/index.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**

```ts
export const projectRunnerWorldState = (
  playerId: string,
  motion: RunnerMotionState,
  route: RunnerRoute,
): BaserunnerWorldState;
```

The projection must derive canonical world `position` and `velocity` from route distance/tangent while keeping richer motion state internal to the runner subsystem.

- [ ] **Step 1: Write failing projection test**

Require correct world position/velocity on both straight and arc route samples.

- [ ] **Step 2: Implement projection and verify GREEN**

Do not expand `CanonicalWorldSnapshot` merely to expose internal runner controls; preserve its renderer-friendly position/velocity contract.

- [ ] **Step 3: Add failing Core API export test**

Require `advanceRunnerMotion`, `sampleRunnerRoute`, `sampleRunnerPhysicalTouchPoint`, `findRunnerBaseTouchTick`, and `projectRunnerWorldState` through `src/core/index.ts`.

- [ ] **Step 4: Export runner modules and run full regression**

Run: `npm run verify`.

Expected: `tsc --noEmit` succeeds and every Vitest test passes.

- [ ] **Step 5: Commit**

Commit message: `feat: expose runner physical movement from Core`
