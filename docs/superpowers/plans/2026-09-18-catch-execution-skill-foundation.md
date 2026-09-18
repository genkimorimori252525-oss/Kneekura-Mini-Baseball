# Catch Execution Skill Foundation Plan

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
