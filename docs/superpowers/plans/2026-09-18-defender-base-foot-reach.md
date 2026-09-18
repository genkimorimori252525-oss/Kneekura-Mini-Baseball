# Defender Base Foot Reach Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Generate left/right foot physical primitives for base contact from canonical defender body kinematics plus a bounded relative leg/foot reach, instead of hand-placing a foot primitive on the base.

## Architecture

```text
DefenderBodyKinematicsSegment
 + current foot relative offset/velocity
 + target base contact point
 + target tick
 + leg reach calibration
        ↓
DefenderBaseFootReach
        ↓
DefenderPosePrimitiveSegment (left_foot/right_foot)
        ↓
composeDefenderPhysicalPrimitiveSegment
        ↓
DefenderPhysicalPrimitiveSegment
        ↓
existing DefenderBaseContact
```

## Contact target

- The desired foot target is a point on the existing rotated `BaseTouchRegion`.
- The target is specified by a base-local X/Z offset and explicit base-surface world Y.
- The base-local target must lie inside the finite base rectangle.
- World target X/Z is derived from base center + base rotation; no caller duplicates field geometry.

## Physical constraints

- Foot role must be `left_foot | right_foot`.
- Body segment provides authoritative start position/velocity/acceleration and clock.
- Foot reach state starts at the body segment start tick and contains relative offset + relative velocity.
- Constant relative acceleration is solved so the foot reaches the desired body-relative offset at target tick.
- Maximum relative foot acceleration and terminal relative foot speed are explicit calibration limits.
- Maximum leg reach is checked against the desired relative offset at target.
- If any physical limit is exceeded, return `null`; do not teleport the foot.
- The returned primitive ends at target tick. Contact timing itself remains owned by the existing analytic foot/base contact solver and may occur before target tick when the foot first enters the finite base surface.
- No direct “base reached” result is produced by the reach planner.

### Task 1: Base-foot reach planner

Create `DefenderBaseFootReach.ts`.

### Task 2: Regression fixtures

Require:
- reachable target produces a valid left/right foot primitive;
- sampled primitive center reaches the requested base target at target tick;
- existing foot/base solver finds first contact from that generated primitive;
- over-long leg reach returns null;
- excessive required acceleration returns null;
- excessive terminal foot speed returns null;
- target local point outside base fails explicitly.

### Task 3: First-base race integration

Replace hand-placed foot fixture in the end-to-end first-base physical race with a foot primitive generated from body kinematics.

### Task 4: Core API + evidence

Export through Core and retry P0 Core CI while preserving the external pre-step-blocker distinction if applicable.
