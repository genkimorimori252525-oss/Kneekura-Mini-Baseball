# Batter-Runner Unified World Timeline Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

**Goal:** Compose swing-exit recovery and post-launch RunnerMotion behind one authoritative sampling boundary so CanonicalWorldSnapshot / Presentation never chooses which running subsystem owns a tick.

## Scope boundary

The current Core has authoritative batter body state beginning at `SwingExitBodyState.tick`. It does **not** yet have a full-body swing trajectory from bat-ball contact to that body-state tick.

Therefore this bounded implementation deliberately starts at `SwingExitBodyState.tick`.

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

- One public sampler owns every tick from `SwingExitBodyState.tick` through the configured timeline end **while this prebuilt trajectory remains the active canonical motion plan**.
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
- A later canonical discontinuity (collision/re-plan/forced displacement/debug effect) invalidates the obsolete future route ownership. Future general orchestration must rebase a new motion plan from the actual canonical position/velocity rather than snapping the runner back onto this timeline.
- `RunnerRoute` is therefore a bounded deterministic trajectory tool, not the universal definition of where a runner is allowed to exist.
- Contact-to-swing-exit full-body motion remains unresolved rather than guessed.

This compatibility rule is governed by `docs/game-design/05-world-first-live-ball-architecture.md`.

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


---

## Completion evidence

Implemented through HEAD `bb75dbeb793ee8bc63784ced34b8c829c2dbd5c1`:

- one phase-aware sampler owns every tick from swing-exit recovery through configured post-launch RunnerMotion;
- `launchTick` remains recovery-owned and ownership switches to RunnerMotion only on the next tick;
- post-launch motion reuses `advanceRunnerMotion` and `projectRunnerWorldState` instead of duplicating equations;
- recovery / RunnerMotion clock-rate compatibility is validated;
- inherited launch speed is validated against RunnerMotion top speed;
- recovery launch world position/velocity is checked against the supplied post-launch RunnerRoute before timeline construction succeeds;
- sampling outside the authoritative interval fails explicitly;
- canonical snapshot upsert replaces one existing batter entry or appends one new entry while preserving defenders, ball, and unrelated runners;
- duplicate batter-runner identities in an input snapshot fail explicitly;
- shared Core API coverage includes timeline build/sample and snapshot projection.

TDD / implementation checkpoints:
- `ab4ed92b...`: unified timeline RED fixtures;
- `e7b2715f...`: first unified timeline implementation;
- `83d40ca5...` / `205bdb87...`: route-boundary and inherited-speed guards;
- `946d669b...` / `16b26d20...`: shared Core API RED/GREEN;
- `a90c444c...` / `5e7e39b1...`: canonical snapshot upsert RED/GREEN;
- `bb75dbeb...`: snapshot projection API coverage.

Repository CI:
- P0 Core run `35321154278` for `bb75dbeb...` failed before any workflow command executed;
- job `105523707667` reports `steps=[]`;
- full-repository GREEN is not claimed.

## Remaining explicit gap

The post-launch sampler currently calls `advanceRunnerMotion` from the launch state for each queried tick. This is deterministic and correct by construction, but repeated Presentation sampling rebuilds the same analytic trajectory prefix. The next slice should expose generic sampling of `RunnerMotionTrajectory` and let the unified batter-runner timeline build the post-launch trajectory once.