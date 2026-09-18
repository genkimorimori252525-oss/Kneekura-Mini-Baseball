# RunnerMotion Trajectory Sampling Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Make the existing analytic RunnerMotion trajectory directly sampleable at any authoritative tick, then reuse that one prebuilt trajectory from the unified batter-runner world timeline.

## Architecture

```text
RunnerMotionState
 + RunnerMotionIntent
 + RunnerMotionParameters
 + end tick
        ↓
buildRunnerMotionTrajectory
        ↓
RunnerMotionTrajectory
  startTick
  ticksPerSecond
  analytic segments
  endState
        ↓
sampleRunnerMotionTrajectory(tick)
        ↓
RunnerMotionState
        ↓
projectRunnerWorldState
```

## Semantics

- No new motion equations are introduced.
- Sampling evaluates the existing constant-acceleration segment equations.
- At an internal control boundary, the later segment owns the exact boundary tick so reaction/control changes become authoritative at that tick.
- At trajectory end, `endState` is authoritative. This preserves cases where an intent reaction gate opens exactly at the end tick even though no time remains for movement under the new control.
- Integer authoritative ticks remain the query surface.
- Position/speed are evaluated from continuous elapsed seconds derived from the trajectory's own `ticksPerSecond`.
- Sampling outside the built interval fails explicitly.

### Task 1: Enrich trajectory metadata

Add `startTick` and `ticksPerSecond` to `RunnerMotionTrajectory`.

### Task 2: Generic sampler

Add `sampleRunnerMotionTrajectory(trajectory, tick)`.

Fixtures must cover:
- reaction-delay interior sampling;
- exact reaction boundary ownership;
- exact end-state ownership;
- acceleration-to-top-speed segment boundary;
- equality with `advanceRunnerMotion(..., tick-startTick)`.

### Task 3: Unified timeline reuse

Change `BatterRunnerWorldTimeline` to build one post-launch RunnerMotion trajectory at construction and sample it thereafter.

Require timeline samples to remain exactly equal to independently advanced RunnerMotion.

### Task 4: Core API + evidence

Expose the generic sampler through Core, retry P0 Core CI, and retain the external pre-step blocker distinction if Actions again reports `steps=[]`.
