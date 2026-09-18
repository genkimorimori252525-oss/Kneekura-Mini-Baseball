# Batter-Runner First-Base Physical Fact Adapter Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Convert exact first-base touch timing from the unified batter-runner timeline into the existing RunnerBaseTouchFact and feed existing first-base / ground-ball RuleEngine entry points without introducing new rule semantics.

## Architecture

```text
BatterRunnerWorldTimeline
        +
first-base geometry/body contact
        ↓
findBatterRunnerPostLaunchBaseTouchTick
        ↓
RunnerBaseTouchFact(base=1)
        ↓
existing BatterRunnerFirstBaseRule
        ↓
existing GroundBallFirstBase RuleEngine
```

## Permanent constraints

- Physics owns the touch tick.
- The adapter never compares runner/defender times itself.
- `createRunnerBaseTouchFact` remains the fact constructor and validator.
- A missing physical touch remains `null`; it is not guessed.
- Existing `simultaneous` semantics remain unchanged.
- Existing third-out scoring semantics remain unchanged.
- Defender controlled-base contact remains a separately supplied physical fact.
- No renderer state participates in rule resolution.

### Task 1: Physical fact adapter

Create `BatterRunnerFirstBasePhysicalAdapter.ts`.

Provide:
- `createBatterRunnerFirstBaseTouchFactFromTimeline`.

### Task 2: Existing-rule convenience entry points

Provide:
- `resolveBatterRunnerFirstBaseFromTimeline`;
- `resolveGroundBallFirstBaseRuleFromTimeline`.

Both must only construct the runner-touch fact and delegate to the existing rule functions.

### Task 3: Regression fixtures

Require:
- generated fact tick equals the timeline's exact base-touch tick;
- defender control one tick earlier => existing OUT result;
- runner touch one tick earlier => existing SAFE result;
- exact same tick => existing simultaneous/unresolved behavior;
- two-out batter-runner-before-first path still suppresses runs through the existing GroundBallFirstBase RuleEngine.

### Task 4: Core API + evidence

Export through Core, retry P0 Core CI, and preserve the external `steps=[]` blocker distinction if it recurs.
