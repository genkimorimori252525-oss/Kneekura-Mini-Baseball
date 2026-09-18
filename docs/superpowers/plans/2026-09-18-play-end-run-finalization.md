# Play-End Pending Run Finalization Plan

**Goal:** Finalize home touches that remain pending because no third out has yet invalidated them, but only after the simulation establishes an authoritative end-of-play boundary.

## Why this layer exists

RuleEngine now intentionally keeps home touches pending after:
- a safe batter-runner first-base result;
- a non-third force out;
- a non-third tag out.

That is necessary because a later third out in the same live-ball play can still determine whether those runs count. Pending touches therefore need a separate finalization boundary once no further live-ball rule event can alter the play.

## Architecture

```text
pending home-touch facts
        +
authoritative PlayEndFact
        ↓
PlayRunFinalization
        ↓
final scored home touches
```

## Constraints

- This module does **not** decide when a live play is over.
- The match/play coordinator supplies an authoritative `PlayEndFact`.
- Presentation state cannot create a play-end boundary.
- A pending home touch at or before the play-end tick can be finalized.
- A home touch after the play-end tick is invalid input and must not be silently counted.
- Unresolved simultaneous rule states must be resolved before this finalizer is called.
- Third-out scoring remains in `ThirdOutScoring`; this finalizer is only for plays that end without a third-out scoring override.
- RuleProfile-specific dead-ball awards remain future work.

### Task 1: PlayEndFact

Extend physical/rule boundary facts with:
- authoritative end tick;
- reason: `live_action_complete` or `dead_ball`.

### Task 2: Pending run finalizer

Create `PlayRunFinalization.ts`.

Input:
- pending home touches;
- PlayEndFact.

Output:
- scored touches;
- finalizedAt tick.

All pending touches must be base 4 and at/before play end.

### Task 3: RuleEngine integration helper

Add a helper that accepts the pending-home-touch output from a non-third-out RuleEngine result and an authoritative play-end fact.

Acceptance:
- runner touches home;
- batter reaches first safely;
- no later third out;
- play ends later;
- pending home touch becomes scored exactly once.

Companion:
- if a later tag becomes the third out before play end, the existing third-out scoring path is used instead and this finalizer is not invoked.

### Task 4: Core API + local verification and P0 CI retry.
