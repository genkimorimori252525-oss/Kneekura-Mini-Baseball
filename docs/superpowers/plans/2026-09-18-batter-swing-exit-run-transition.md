# Batter Swing-Exit to Run Transition Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Connect the batter's physical state immediately after contact/follow-through to the existing batter-runner route and motion system so first-base launch differences emerge from body orientation and residual body velocity rather than a direct time bonus.

## Architecture

```text
BatBallContact / resolved plate appearance
        +
SwingExitBodyState
  tick
  planar body velocity
  body-forward direction
        +
BatterRunnerFirstBaseRoute
        ↓
SwingExitRunTransition
        ↓
route-aligned launch tick
route progress already made
initial route speed
        ↓
existing RunnerMotion
        ↓
existing RunnerBaseTouch
        ↓
exact first-base touch tick
```

The current `BatterSwingState` is a bat state, not a full human-body state. This phase therefore does not infer body orientation from bat angle. It introduces an explicit body-state boundary that a future detailed swing/body model can populate.

## Permanent constraints

- No handedness or swing-style time bonus is added directly to first-base arrival.
- No hit-result probability is affected directly.
- Swing-exit body state is an authoritative physical input, separate from bat rigid-body state.
- Body-forward direction is a validated unit vector.
- The first-base route tangent is taken from the existing authoritative `RunnerRoute`.
- Residual velocity is decomposed into:
  - forward route velocity;
  - lateral velocity;
  - backward route velocity.
- Mechanical transition time is caused by:
  - required body reorientation;
  - damping lateral body motion;
  - braking backward body motion.
- Those recovery processes may happen concurrently, so the mechanical recovery duration is their maximum rather than their sum.
- Positive route-directed residual momentum may carry the batter forward during recovery.
- Backward route velocity does not create negative authoritative route distance in this first slice; it is paid as braking/recovery time.
- After the transition, existing `RunnerMotion` owns acceleration/top speed/braking/slide behavior.
- Calibration values remain explicit inputs. Fixtures are not final athlete calibration.

### Task 1: Swing-exit body state and mechanical transition

Create `BatterSwingExitRunTransition.ts`.

Input:
- `SwingExitBodyState`:
  - tick;
  - planarVelocity;
  - bodyForwardUnit;
- first-base `RunnerRoute`;
- transition parameters:
  - ticksPerSecond;
  - maximumBodyTurnRateRadiansPerSecond;
  - lateralVelocityDampingMps2;
  - backwardVelocityBrakingMps2.

Output:
- launch tick;
- route distance already covered during transition;
- initial route speed;
- required turn angle;
- component recovery durations.

### Task 2: Causal posture fixture

Using one batter stance/route and otherwise equal athlete parameters:
- route-aligned body orientation + positive forward residual velocity must launch earlier/faster;
- a 90-degree body orientation + lateral residual velocity must require recovery;
- no direct bonus field may exist.

### Task 3: Exact first-base arrival integration

Feed the two launch results into identical `RunnerMotion` / `RunnerBaseTouch` parameters.

Require:
- the better exit body state reaches first earlier;
- changing only swing-exit posture/velocity changes the exact first-base touch tick.

### Task 4: Core API + evidence

Export the new transition boundary through Core and add shared API coverage.

Retry P0 Core CI. Do not claim repository GREEN while GitHub Actions still terminates before executing workflow steps.
