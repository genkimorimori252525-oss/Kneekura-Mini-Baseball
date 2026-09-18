# Batter Swing-Exit to Run Transition Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

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
  - bounded-acceleration lateral realignment back to the route line;
  - bounded-acceleration recovery from backward route momentum back to the route origin.
- Those recovery processes may happen concurrently, so the mechanical recovery duration is their maximum rather than their sum.
- Positive route-directed residual momentum may carry the batter forward during recovery.
- Adverse lateral/backward components use a two-phase bounded-acceleration recovery that ends on the intended route line/origin with zero adverse residual velocity; launch therefore requires no positional snap.
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
  - lateralRealignmentAccelerationMps2;
  - backwardRecoveryAccelerationMps2.

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


---

## Completion evidence

Implemented through HEAD `5eacaa12a198b20026d3803822a9dc68c0abd550`:

- explicit `SwingExitBodyState` separated from rigid-bat `BatterSwingState`;
- route-tangent decomposition of residual body velocity;
- body reorientation time from validated body-forward direction;
- bounded-acceleration lateral realignment that returns to the route line instead of snapping;
- bounded-acceleration backward recovery that returns to the route origin instead of creating negative authoritative route distance;
- concurrent recovery: orientation/lateral/backward processes use the maximum component duration;
- preservation of positive route-directed residual momentum;
- exact authoritative launch-tick quantization;
- contact-time guard preventing swing-exit state from preceding bat-ball contact;
- adapter into the existing `RunnerMotionState`;
- exact first-base-touch regression using unchanged `RunnerMotion` and `RunnerBaseTouch`;
- shared Core API export.

The adverse-component recovery uses a deterministic two-phase bounded-acceleration solution. For initial adverse speed `v` and acceleration bound `a`, the recovery duration is:

`(1 + sqrt(2)) * v / a`

This is the minimum-time two-phase solution that returns displacement to the intended line/origin and ends with zero adverse velocity. It is a mechanical model, not a probability or handedness bonus.

TDD / implementation checkpoints:
- `0697d3c8...`: initial posture/velocity and exact-base-touch RED fixture;
- `e40c6e9d...`: first swing-exit transition implementation;
- `5b27dce3...`: projection-roundoff test correction;
- `1a7c957e...` / `cd44ca44...`: shared Core API RED/GREEN;
- `b1c11c4f...` / `d3a363df...`: contact-timeline RED/GREEN;
- `29cc25b6...`: backward-momentum regression;
- `8d3a4b3a...`: route-alignment floating-point canonicalization;
- `acb1db47...` / `5eacaa12...`: no-snap route-realignment RED/GREEN.

Repository CI:
- P0 Core run `35319381660` for `5eacaa12...` failed before any workflow command executed;
- job `105518205400` reports `steps=[]`;
- full-repository GREEN is not claimed.

## Next physical slice

The endpoint transition is now causal, but Presentation and CanonicalWorldSnapshot still need an analytic world-space trajectory during the recovery interval itself. The next slice should expose deterministic position, velocity, and body-facing samples throughout swing-exit recovery so Mini/Natural presentation never has to interpolate or invent that movement.
