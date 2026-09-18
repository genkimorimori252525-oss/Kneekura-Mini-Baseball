# Batter Swing-Exit Recovery World Trajectory Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Expose deterministic world-space body motion throughout the swing-exit recovery interval so Presentation never invents or interpolates batter movement that the Match Core did not calculate.

## Architecture

```text
SwingExitBodyState
        +
BatterRunnerFirstBaseRoute
        +
SwingExit transition parameters
        ↓
BatterSwingExitRecoveryTrajectory
        ↓
sample(tick)
  world position
  world velocity
  body-forward direction
        ↓
BaserunnerWorldState projection
        ↓
Canonical / Presentation consumers
        ↓
launch endpoint
        ==
RunnerMotion launch state
```

## Constraints

- No renderer-owned transition interpolation.
- The first authoritative batter-runner route segment must be linear for this slice.
  The current stance-to-first route satisfies this.
- Positive route-directed residual velocity advances continuously along the initial route line.
- Lateral adverse velocity uses the same two-phase bounded-acceleration realignment model as the endpoint transition.
  It may move off the route during recovery, but returns to zero lateral displacement and zero lateral velocity at launch.
- Backward residual velocity may move the body behind the route origin during recovery, but the two-phase recovery returns to the route origin with zero backward velocity at launch.
- Body facing rotates continuously toward the route tangent at the configured maximum angular rate and then remains aligned.
- At launch, sampled world position and velocity must match the state handed to `RunnerMotion`; no spatial or velocity snap is permitted.
- Authoritative ticks remain integer; continuous equations are sampled at the exact elapsed time represented by the tick, clamped to the resolved physical recovery duration when launch was quantized upward.
- Calibration values remain explicit inputs.

### Task 1: Analytic recovery trajectory

Create `BatterSwingExitRecoveryTrajectory.ts`.

Provide:
- trajectory builder;
- deterministic sampler;
- signed body-turn interpolation;
- bounded-acceleration adverse-component sampling.

### Task 2: World projection

Provide a projection from a recovery sample to `BaserunnerWorldState`.

### Task 3: Continuity fixture

Prove:
- sideways recovery leaves and returns to the route line continuously;
- backward recovery may move behind the start but returns to the route origin;
- launch sample position/velocity equals the existing `RunnerMotionState` launch boundary.

### Task 4: Core API + evidence

Export through Core and retry P0 Core CI without claiming repository GREEN while Actions remains pre-step blocked.
