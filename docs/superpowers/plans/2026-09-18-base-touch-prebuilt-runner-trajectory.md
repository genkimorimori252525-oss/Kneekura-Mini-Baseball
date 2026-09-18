# Base Touch on Prebuilt RunnerMotionTrajectory Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

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


---

## Completion evidence

Implemented through HEAD `4ed2b474f21a16446ceac76b9f167bf63d933a68`:

- `findRunnerBaseTouchTickOnTrajectory` resolves exact base touch directly from an existing `RunnerMotionTrajectory`;
- the solver uses the trajectory's own `startTick` and `ticksPerSecond`;
- existing base geometry, lead-distance semantics, segment ordering, and exact tick quantization are preserved;
- legacy `findRunnerBaseTouchTick` now only builds the trajectory and delegates;
- unified batter-runner timeline exposes `findBatterRunnerPostLaunchBaseTouchTick`, which consumes the exact same stored post-launch trajectory used by world sampling;
- regression requires the timeline/prebuilt result to equal the legacy wrapper tick;
- shared Core API coverage exposes both prebuilt-trajectory base-touch entry points.

TDD / implementation checkpoints:
- `a409c020...`: prebuilt trajectory base-touch RED fixture;
- `97863051...`: exact solver extraction and legacy wrapper delegation;
- `40294a08...`: unified timeline base-touch consistency RED;
- `c8c205b2...`: timeline base-touch adapter;
- `4ed2b474...`: shared Core API coverage.

Repository CI:
- P0 Core run `35321657067` for `4ed2b474...` failed before any workflow command executed;
- job `105525287693` reports `steps=[]`;
- full-repository GREEN is not claimed.

## Next boundary

The exact runner touch tick can now come from the same trajectory used for Presentation. The next slice should convert that tick into the existing `RunnerBaseTouchFact` and feed the already-existing `BatterRunnerFirstBaseRule` / `RuleEngine` without adding any new rule semantics.
