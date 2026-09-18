# Catch Execution Skill Foundation Plan

**Status:** IMPLEMENTATION COMPLETE; repository CI verification blocked because GitHub Actions jobs stop before creating steps.

**Goal:** Make catching/body-control abilities affect physical execution error and difficult-pose stability without introducing a direct catch-success probability.

**Source:** Approved `2026-09-17-time-running-catching-perception-umpire-design.md` §5.3:
- catching affects glove target error;
- body-control error / difficult-pose stability;
- secure-possession tolerance and impact/spin tolerance;
- numerical ranges are calibrated later, not fixed in the design.

This phase implements the first two effects and feeds stability into the already-existing `CatchRetention` boundary. Retention-capacity calibration remains a later phase.

## Architecture

```text
PerceivedGloveTarget
        +
catching ability [0,1]
        +
externally supplied error calibration
        +
fielding RNG stream
        ↓
ExecutedGloveTarget
(perceived aim + deterministic execution error)
        ↓
GloveReachExecution
        ↓
physical glove path / contact

reach effort
+ body-control ability [0,1]
+ externally supplied stability calibration
        ↓
bodyStability [0,1]
        ↓
CatchRetention
```

## Permanent constraints

- No `catching = N -> N% catch` shortcut.
- No hard-coded player error widths in Core. Error/stability ranges are explicit calibration inputs.
- RNG is passed in by the caller. The caller can derive a player/play-specific `SeedRoot.streamRng(..., 'fielding', ...)`; this module does not consume unrelated RNG streams.
- Same seed/sample + higher catching ability reduces error scale, but does not guarantee a catch.
- Target execution error is distinct from perception error. A player may see the ball correctly and execute the glove target poorly, or vice versa.
- Body stability is deterministic from ability + physical reach effort in this foundation; no random success roll.
- Stability feeds the existing retention-energy calculation; contact and possession remain separate.

### Task 1: Calibrated target-execution error

Create `CatchExecutionSkill.ts` + tests.

Inputs:
- desired glove target assessment;
- catching ability in [0,1];
- deterministic RNG;
- calibration `minimumTargetErrorMeters / maximumTargetErrorMeters`.

Behavior:
- linearly interpolate error scale from max at ability 0 to min at ability 1;
- draw independent symmetric triangular X/Y/Z execution errors;
- return a new target assessment with adjusted desired offset / predicted target position;
- preserve source perception metadata;
- do not mutate input;
- same seed gives same error;
- same RNG seed with higher ability scales the same underlying sample to a smaller error.

### Task 2: Difficult-pose body stability

Add pure stability evaluation.

Inputs:
- body-control ability in [0,1];
- `reachDistanceMeters / maximumReachMeters`;
- calibration:
  - lowest-ability stability at full reach;
  - highest-ability stability at full reach.

Behavior:
- reach effort 0 -> stability 1;
- full reach -> calibrated ability-dependent stability;
- intermediate effort interpolates continuously;
- target outside reach -> stability 0;
- no RNG and no direct catch result.

### Task 3: Retention integration vertical slice

With identical physical ball/contact:
- same perception and body motion;
- skill execution error can move contact toward/away from pocket center through physical geometry input;
- higher body-control produces a higher `bodyStability`;
- feed that stability into `evaluateCatchRetentionLoad`;
- demonstrate that skill changes `effectiveCapacityJ`, not ball energy or a success probability.

### Task 4: Core API and full regression

Export the new skill/execution functions from `src/core/index.ts`.
Run full `npm run verify` and record exact test counts.

## Deferred

- calibration from tracking/error data;
- facing-specific target-error covariance;
- handedness;
- jump/dive stability;
- catching ability -> retention capacity / impact-spin tolerance calibration;
- fatigue/context modifiers.


---

## Implementation Evidence

Implemented through HEAD `7e3e7d5b5a4634b1ee1f22caa8306f4e5668dad2`:
- deterministic catching-ability target execution error;
- caller-supplied calibration range with no hard-coded player error widths;
- same RNG sample scales continuously with catching ability;
- target error remains separate from perceived-ball error;
- body-control ability maps to difficult-reach stability;
- reach beyond the physical envelope produces zero stability;
- integration test feeds execution centering + body stability into existing `CatchRetention`;
- shared Core API exports.

Independent verification while GitHub Actions is unable to start jobs:
- TypeScript 5.8 source-level check of `CatchExecutionSkill`: success;
- deterministic numerical integration check: success;
- same physical incoming ball produced the same retention load (~4.65554 J) for both skill levels;
- sample low-skill effective retention capacity: ~3.16687 J;
- sample high-skill effective retention capacity: ~7.35624 J.

Repository CI state:
- last normal successful P0 Core run: `35301599943` at `4c4b8de0a5ac8845f9aebb4dd138d1d2fd3d495e`;
- starting with run `35301673476`, jobs fail before any workflow step is created (`steps=null`);
- the same pre-step failure continues through implementation HEAD run `35302190978`;
- therefore full repository test count is intentionally not claimed for this phase yet.
