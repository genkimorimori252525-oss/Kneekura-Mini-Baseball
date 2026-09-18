# RunnerMotion Trajectory Sampling Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

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


---

## Completion evidence

Implemented through HEAD `1f070594a44b89b430d63662bd257433893991b8`:

- `RunnerMotionTrajectory` now carries authoritative `startTick` and `ticksPerSecond`;
- `sampleRunnerMotionTrajectory` evaluates the existing analytic constant-acceleration segments without introducing new motion equations;
- internal segment boundaries are sampled from the later segment so newly active control owns the exact reaction/control boundary tick;
- exact trajectory end uses `endState`, preserving intent gates that open exactly at the endpoint;
- arbitrary sampled states are regression-compared against independent `advanceRunnerMotion` results;
- unified batter-runner timeline now builds one post-launch trajectory and reuses it for all post-launch samples;
- shared Core API exposes the generic sampler.

TDD / implementation checkpoints:
- `af019c8e...`: generic trajectory-sampling RED fixtures;
- `55775df0...`: trajectory metadata + sampler implementation;
- `bfbad54f...`: unified timeline switched from repeated prefix rebuilding to prebuilt trajectory sampling;
- `1f070594...`: shared Core API coverage.

Repository CI:
- P0 Core run `35321423554` for `1f070594...` failed before any workflow command executed;
- job `105524555608` reports `steps=[]`;
- full-repository GREEN is not claimed.

## Next physical/rules consistency slice

`RunnerBaseTouch` still rebuilds a motion trajectory internally. The next slice should expose exact base-touch resolution directly on an existing `RunnerMotionTrajectory`, then make the batter-runner unified timeline use that same prebuilt trajectory for both world sampling and exact first-base touch timing.
