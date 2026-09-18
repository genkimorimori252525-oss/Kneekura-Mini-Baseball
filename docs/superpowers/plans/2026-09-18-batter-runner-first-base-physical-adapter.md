# Batter-Runner First-Base Physical Fact Adapter Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

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


---

## Completion evidence

Implemented through HEAD `a49db64e60ba331ba6136c587407396e6227da23`:

- exact first-base touch from the unified batter-runner timeline is converted through the existing `createRunnerBaseTouchFact`;
- `resolveBatterRunnerFirstBaseFromTimeline` delegates only to the existing `BatterRunnerFirstBaseRule`;
- `resolveGroundBallFirstBaseRuleFromTimeline` delegates only to the existing GroundBallFirstBase RuleEngine;
- OUT / SAFE / simultaneous semantics remain unchanged;
- two-out batter-runner-before-first run suppression remains unchanged and is regression-covered through the existing RuleEngine;
- defender controlled-base contact remains a separately supplied physical fact;
- shared Core API exposes all three adapters.

TDD / implementation checkpoints:
- `c55f0f33...`: physical-fact / existing-rule RED fixtures;
- `b7ef74dc...`: timeline-to-first-base-rule adapter implementation;
- `f33a4d3f...`: shared Core export;
- `a49db64e...`: shared Core API coverage.

Repository CI:
- P0 Core run `35321915030` for `a49db64e...` failed before any workflow command executed;
- job `105526086225` reports `steps=[]`;
- full-repository GREEN is not claimed.

## Next physical gap

The runner side of the first-base race is now trajectory-derived end-to-end. The remaining physical input to the rule is `ControlledBaseContactFact`: the tick at which a defender both controls the ball and physically satisfies the first-base contact requirement. The next slice should derive that fact from defender/ball/base physical state rather than constructing it directly in rule-facing code.
