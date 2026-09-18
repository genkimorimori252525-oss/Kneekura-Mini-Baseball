# Force Obligation Satisfaction Plan

**Goal:** Track when an active participant has already acquired the base required by their current advancement obligation, so that the participant can no longer be force-out at that target while still preserving force pressure on runners ahead.

## Why this is separate from retirement

A participant can be:
- active and obligation still unsatisfied;
- active and obligation already satisfied at the target base;
- retired.

An active satisfied participant still occupies/claims the target in the force chain. Therefore satisfaction must remove only **that participant's pending force-out liability**, not break the active chain. Retirement breaks the chain.

Example from bases loaded:
- batter safely reaches first -> batter cannot later be retired merely by another touch of first base;
- R1 is still forced to second because the batter remains active;
- R1 safely reaches second -> R1's own force obligation is satisfied;
- R2 remains forced to third because R1 remains active;
- if R1 is later retired by another valid rule path, R2/R3 force pressure can dissolve.

## Architecture

Extend `ForceParticipant`:
- `active`
- `obligationSatisfied`

`deriveCurrentForceObligations`:
- chain continuity depends on active participants;
- an obligation is emitted only for an active participant whose obligation is not satisfied;
- satisfied participants do not break propagation to the next participant.

Add:
- `satisfyForceParticipantObligation(state, runnerId)`
- `applyForceOutRuleResultToState(state, result)`

Transition:
- force result `safe` -> mark that runner's obligation satisfied;
- force result `out` -> retire runner;
- simultaneous/unresolved -> no state transition.

Batter-runner first-base satisfaction is supported by the state model but its correct-rule result remains the dedicated batter-runner rule.

## Constraints

- Satisfaction does not move the runner into a general current-base occupancy model yet.
- Voluntary advancement beyond the forced target is deferred.
- Retreat/re-touch edge cases are deferred.
- A satisfied participant remains in the active force chain until retired.
- Same-tick unresolved results do not mutate state.

### Task 1

Extend ForceObligation state and derivation with obligation satisfaction.

Tests:
- batter safe at first removes batter's pending obligation but R1 remains forced to second;
- R1 safe at second removes R1 pending obligation but R2 remains forced to third;
- retiring a satisfied R1 still breaks the force on R2/R3.

### Task 2

Add force-result state transition helper.

Tests:
- `safe` -> satisfy;
- `out` -> retire;
- `simultaneous/unresolved` -> unchanged.

### Task 3

Double-play causal vertical slice:
- bases loaded or runners 1+2;
- R1 forced out at second -> retire R1;
- force on R2 disappears;
- batter-runner still has first-base special obligation;
- later batter-runner first-base out can become the next out / third out;
- no stale force obligation is reused.

### Task 4

Core API + local verification; retry P0 Core CI without claiming full GREEN while Actions remains pre-step blocked.
