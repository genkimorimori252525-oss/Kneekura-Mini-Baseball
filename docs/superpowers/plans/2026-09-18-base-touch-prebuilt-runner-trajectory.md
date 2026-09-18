# Base Touch on Prebuilt RunnerMotionTrajectory Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Resolve exact base-touch timing directly from an already-built RunnerMotionTrajectory so world sampling and rule-relevant contact timing consume the same authoritative motion object.

## Architecture

```text
RunnerMotionState + Intent + Parameters
            ↓
buildRunnerMotionTrajectory
            ↓
RunnerMotionTrajectory
       ┌────┴────┐
       ↓         ↓
world sample   base-touch solver
       ↓         ↓
Presentation  exact TimedMatchEvent fact
```

## Permanent constraints

- Existing base geometry and body lead semantics do not change.
- Existing `findRunnerBaseTouchTick` remains as a convenience wrapper.
- New `findRunnerBaseTouchTickOnTrajectory` performs no motion rebuild.
- The prebuilt trajectory's own `startTick` and `ticksPerSecond` are authoritative.
- The initial center-position base check remains preserved.
- Segment boundary ordering and exact-time quantization remain unchanged.
- The wrapper and prebuilt-trajectory API must return identical ticks for identical motion.
- No renderer-derived position is used for rule timing.

### Task 1: Extract exact solver

Refactor `RunnerBaseTouch.ts` so the existing segment/base intersection loop accepts `RunnerMotionTrajectory`.

### Task 2: Preserve wrapper behavior

`findRunnerBaseTouchTick(start, intent, ...)` builds once and delegates.

### Task 3: Unified timeline consistency

Require the unified batter-runner timeline's stored `postLaunchTrajectory` to produce the same first-base touch tick as the legacy wrapper from the same launch state / intent / duration.

### Task 4: Core API + evidence

Expose the prebuilt-trajectory solver through Core, retry P0 Core CI, and keep the `steps=[]` external-blocker distinction if it recurs.
