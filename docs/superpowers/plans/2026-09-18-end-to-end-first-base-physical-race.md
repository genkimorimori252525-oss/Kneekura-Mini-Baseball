# End-to-End First-Base Physical Race Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Resolve a first-base race from one causal evidence chain: accelerated throw reception, catch retention, defender foot/base control, batter-runner trajectory/base touch, then the existing first-base rule.

## Architecture

```text
accelerated thrown ball + glove primitive
        ↓
CatchRetentionContact
        ↓
CatchRetentionResolution
   secured | live-ball
        ↓
secure possession + defender foot/base contact
        ↓
ControlledBaseContactFact | null

batter swing/runner world timeline
        ↓
RunnerBaseTouchFact | null

        both facts
           ↓
existing BatterRunnerFirstBaseRule
           ↓
OUT | SAFE | simultaneous | unresolved
```

## Evidence-first result

The vertical slice must return:
- reception contact, if any;
- catch retention resolution, if any;
- defender controlled-base fact, if any;
- runner first-base touch fact, if any;
- existing correct-rule result.

No evidence is discarded merely because a final rule result exists.

## Permanent constraints

- No new OUT/SAFE semantics.
- No direct success probabilities.
- No renderer state.
- No manually injected defender-control tick.
- No manually injected runner-touch tick.
- Glove-ball collision uses the existing accelerated collision solver.
- Possession uses existing CatchRetention.
- Defender base contact uses existing secure-control + foot/base physics.
- Runner touch uses the unified batter-runner timeline's prebuilt motion trajectory.
- Live-ball retention failure produces no defender control.
- No glove-ball contact produces no retention attempt and no defender control.
- Exact physical simultaneity is preserved for the existing rule layer.
- Ground-ball/two-out scoring remains a separate existing RuleEngine layer consuming the same physical facts.

### Task 1: Evidence-preserving first-base race

Create `FirstBasePhysicalRace.ts` in the rules/orchestration layer.

### Task 2: Ordering fixtures

Require:
- physically secured reception + planted foot before runner touch => OUT;
- secure possession after runner touch => SAFE;
- retention failure => unresolved missing defender control;
- exact equal control/touch tick => simultaneous.

### Task 3: Ground-ball RuleEngine adapter

Feed the evidence facts into existing `resolveGroundBallFirstBaseRule` and preserve two-out batter-runner-before-first run suppression.

### Task 4: Core API + evidence

Export through Core and retry P0 Core CI while preserving the external `steps=[]` distinction if it recurs.
