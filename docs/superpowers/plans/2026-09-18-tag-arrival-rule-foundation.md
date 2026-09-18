# Tag Arrival Rule Foundation Plan

**Status:** IMPLEMENTATION COMPLETE; full repository CI remains blocked before workflow steps start.

**Goal:** Add the non-force arrival-play counterpart to ForceOutRule: a runner approaching an entitled target base is out only if a defender with secure ball control physically tags the runner before the runner touches that base.

## Architecture

```text
secure possession
+ physical defender/runner tag contact
        ↓
ControlledRunnerTagFact
        +
runner target-base touch fact
        ↓
TagArrivalRule
  tag strictly first -> OUT (time_play)
  base touch strictly first -> SAFE at arrival
  equal tick -> simultaneous
        ↓
RuleEngine time-play third-out scoring
```

## Constraints

- A raw body collision is not a legal tag fact.
- `ControlledRunnerTagFact` means secure ball possession and physical tag contact have already both been established upstream.
- This rule is scoped to **arrival at a target base**. A runner who touched the base and later left it requires a later off-base/tag state model.
- It is not used when a current force obligation exists and the defense is using controlled-base contact; ForceOutRule remains separate.
- Equal authoritative ticks stay simultaneous.
- Correct Rule Result only; umpire call remains downstream.

### Task 1: Controlled runner tag physical fact

Extend `PhysicalRuleFacts.ts` with:
- defender id;
- runner id;
- authoritative tag tick.

### Task 2: TagArrivalRule

Create `TagArrivalRule.ts`.

Result:
- controlled tag before target-base touch -> `out`, classification `time_play`;
- target-base touch before tag -> `safe`;
- equal -> `simultaneous`;
- missing fact -> `unresolved`.

Reject wrong runner or wrong target-base touch.

### Task 3: Third-out time-play integration

Add `resolveTagOutScoringRule` to RuleEngine.

- not third out -> keep home touches pending;
- third out -> call `resolveThirdOutScoring` with `classification: 'time_play'`;
- runner home before tag third-out tick scores;
- runner home after tag does not;
- equal tick remains `simultaneous_unresolved`.

### Task 4: Force-dissolution companion

Fixture:
- force on a runner disappears because a following runner is retired;
- later controlled base touch alone cannot retire that runner;
- a physical tag before their next base touch can retire them through TagArrivalRule.

### Task 5: Core API + local verification, with P0 CI retried but no full GREEN claim while workflow steps remain unavailable.


---

## Implementation Evidence

Implemented through HEAD `fa8af4befea809b3d15b4e6dc5c92a3baea9259e`:
- controlled runner-tag physical fact;
- tag-arrival correct-rule result;
- exact tag-before-touch / touch-before-tag / simultaneous handling;
- time-play third-out scoring integration;
- force-dissolution companion proving base contact alone is insufficient after force disappears;
- shared Core API export;
- corrected non-third-out ground-ball behavior so home touches remain pending until the play can be finalized.

Independent verification:
- TypeScript 5.8 source-level rules typecheck: success;
- runtime tag-arrival fixture: success;
- force-dissolution -> physical tag out: success;
- time-play third-out scoring: earlier home touch scores, later touch is suppressed;
- same-tick time-play remains unresolved.

Repository CI:
- P0 Core run `35305910092` at HEAD still failed before workflow steps were created;
- full repository GREEN is intentionally not claimed while the repository-wide pre-step `steps=null` condition persists.
