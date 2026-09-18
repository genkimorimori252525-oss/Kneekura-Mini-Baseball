# Batter-Runner Unified World Timeline Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Compose swing-exit recovery and post-launch RunnerMotion behind one authoritative sampling boundary so CanonicalWorldSnapshot / Presentation never chooses which running subsystem owns a tick.

## Scope boundary

The current Core has authoritative batter body state beginning at `SwingExitBodyState.tick`. It does **not** yet have a full-body swing trajectory from bat-ball contact to that body-state tick.

Therefore this phase deliberately starts at `SwingExitBodyState.tick`.

It must not invent motion for:

```text
BatBallContact.tick
        ↓
[future full batter-body swing trajectory]
        ↓
SwingExitBodyState.tick
```

The existing contact-time guard remains responsible for proving that the swing-exit state cannot precede contact.

## Architecture

```text
SwingExitBodyState
        +
RunnerRoute
        +
swing-exit recovery parameters
        +
post-launch RunnerMotionIntent / RunnerMotionParameters
        ↓
BatterRunnerWorldTimeline
        ↓
sample(tick)
  phase = swing_exit_recovery | runner_motion
  BaserunnerWorldState
        ↓
CanonicalWorldSnapshot / Presentation
```

## Permanent constraints

- One public sampler owns every tick from `SwingExitBodyState.tick` through the configured timeline end.
- Presentation must not branch on recovery-vs-RunnerMotion itself.
- At `launchTick`, recovery is authoritative; the next tick is owned by RunnerMotion.
- The RunnerMotion launch state comes only from `createRunnerMotionStateFromSwingExitTransition`.
- Post-launch motion is deterministic and uses the existing `advanceRunnerMotion` / `projectRunnerWorldState` path; no duplicate runner equations.
- Timeline construction rejects:
  - end tick before launch;
  - mismatched ticks-per-second between transition and runner motion;
  - a post-launch intent issued before launch;
  - a post-launch motion top speed lower than the inherited positive launch speed.
- Sampling outside the timeline interval fails explicitly.
- The sampled world state at `launchTick` and `launchTick + 1` must be spatially continuous.
- The unified timeline does not modify `CanonicalWorldSnapshot`; it supplies the runner world state that snapshot composition can consume.
- Contact-to-swing-exit full-body motion remains unresolved rather than guessed.

### Task 1: Unified timeline boundary

Create `BatterRunnerWorldTimeline.ts`.

Provide:
- timeline builder;
- phase-aware sample type;
- deterministic sampler;
- direct `BaserunnerWorldState` projection.

### Task 2: Boundary fixtures

Require:
- a recovery tick samples the analytic recovery trajectory;
- `launchTick` equals the recovery launch sample exactly;
- `launchTick + 1` comes from RunnerMotion and remains continuous;
- later ticks match independently advanced RunnerMotion exactly.

### Task 3: Validation fixtures

Reject:
- query before swing-exit start;
- query after configured end;
- intent issued before launch;
- incompatible tick rates;
- end before launch.

### Task 4: Core API + evidence

Export through Core, add shared API coverage, retry P0 Core CI, and preserve the existing `steps=[]` external-blocker distinction if it recurs.
