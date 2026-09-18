# Perceived Glove Reach Foundation Plan

**Status:** COMPLETE — implemented and verified on 2026-09-18.

**Goal:** Turn a defender's own perceived ball state into a physically bounded glove target and executable reach segment, without reading canonical ball truth and without turning reachability into catch success.

**Source:** Approved catching design requires Contact Feasibility to depend on defender body position/velocity, glove reachable region, glove target position, perceived ball motion, and reaction/route/acceleration. Catching skill must not directly become success probability.

## Architecture

```text
PlayerPerceivedWorldState.ball
(last observed / remembered / predicted)
            +
DefenderBodyKinematics
            ↓
PerceivedGloveTarget assessment
  future perceived ball point
  future body origin
  required relative glove offset
  reach distance / reach envelope
            ↓
GloveReachExecution
  explicit speed / acceleration limits
            ↓
DefenderPosePrimitiveSegment(role=glove)
            ↓
body + pose composition
            ↓
actual glove physical primitive
            ↓
actual canonical ball contact solver
```

The planner aims at what the defender believes, while the contact solver still collides against physical truth. Therefore perception error can naturally create a miss.

## Permanent constraints

- No `CanonicalWorldSnapshot` or canonical ball truth may enter glove targeting.
- The perceived ball's current remembered position/velocity is extrapolated deterministically; no hidden perfect trajectory is substituted.
- Reach envelope values are explicit calibration inputs, never hard-coded player outcomes.
- `withinReach` means geometric target feasibility only, not catch success.
- Reach execution means the glove can physically attempt the target; secure possession remains downstream.
- Catching ratings may later affect target error, stability, reach execution parameters, and retention tolerance. They do not directly flip a success flag.
- This first reach envelope is spherical around the body origin. Facing-aware asymmetric volumes are deferred.
- Constant-acceleration reach execution is a first-order end-effector model; high-DOF arm biomechanics are not introduced.

### Task 1: Perceived glove target assessment

Create `PerceivedGloveTarget.ts` + tests.

Inputs:
- `PlayerPerceivedWorldState`;
- body kinematics segment;
- candidate target tick;
- minimum usable ball confidence;
- maximum reach distance.

Output records:
- source observation metadata;
- predicted perceived ball position at target tick;
- predicted body-origin position at target tick;
- desired relative glove offset;
- reach distance;
- whether the target lies inside the configured reach envelope.

No visible/remembered ball or insufficient confidence -> no target.

### Task 2: Constant-acceleration glove reach execution

Create `GloveReachExecution.ts` + tests.

Input state:
- current relative glove offset;
- current relative glove velocity;
- target assessment.

Parameters:
- glove contact radius;
- max relative reach speed;
- max relative reach acceleration.

Solve the single constant-acceleration segment required to arrive at the desired offset at the candidate target tick.

Return null when:
- target is outside the reach envelope;
- required acceleration exceeds the configured limit;
- terminal relative speed exceeds the configured limit.

### Task 3: Perception-error physical vertical slice

Integration test:
- two defenders/body states are physically identical;
- only perceived ball position differs;
- both generate deterministic glove reach plans;
- actual canonical ball is unchanged;
- the accurate perception produces physical glove-ball contact;
- the offset perception can miss;
- no direct catch-success probability exists.

### Task 4: Core API and full regression

Export target assessment and reach execution through `src/core/index.ts`.
Run full `npm run verify` and record exact test counts.

## Deferred

- scanning/selecting the best target tick across a future horizon;
- gravity/Magnus-aware player-internal trajectory models;
- facing-aware asymmetric reach volume;
- jump/dive/crouch body-origin motion;
- catching-skill target error distribution;
- pose stability and body-control coupling into CatchRetention.


---

## Completion Evidence

Implemented:
- perceived-ball-only future glove target assessment;
- explicit geometric reach-envelope evaluation;
- physically bounded constant-acceleration glove reach execution;
- speed and acceleration feasibility limits without direct success probability;
- integration proof that perception error alone can turn the same canonical ball into contact versus physical miss;
- shared Core API exports.

Verification at implementation HEAD `4c4b8de0a5ac8845f9aebb4dd138d1d2fd3d495e`:
- `tsc --noEmit`: success
- Vitest: 49 test files passed
- Vitest: 240 tests passed
- P0 Core run: `35301599943` success
