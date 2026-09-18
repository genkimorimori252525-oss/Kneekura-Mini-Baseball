# Force Obligation Engine Plan

**Status:** IMPLEMENTATION COMPLETE for play-start/retirement force dynamics; safe-advancement occupancy transitions remain intentionally deferred.

**Goal:** Represent and recompute runner force obligations causally from play-start base occupancy and active participants, so a force can disappear when a following runner is retired.

**Rule basis:** NPB's official scorer explanation states that a runner loses the right to the currently occupied base when the batter becoming a runner creates a force, and that if a following runner is retired first on a force play, the preceding runner's force condition disappears. The 2026 rules revisions continue to reference Definition 30 (Force Play). This phase implements that state transition without relying on presentation/event-array order.

## Architecture

```text
Play-start BaseOccupancy + batterRunnerId
            ↓
ForceParticipantState
  batter runner at virtual base 0
  pre-existing runners at bases 1..3
            ↓
deriveCurrentForceObligations
  contiguous active chain starting at batter runner
            ↓
physical controlled-base / runner-touch facts
            ↓
resolveForceOutAtTarget
            ↓
retire participant
            ↓
recompute obligations from remaining active chain
```

## Permanent constraints

- A runner is not "forced forever" because they started on a particular base.
- Force state is derived from the active following-runner chain.
- Retiring a following runner may dissolve the force on every preceding runner beyond the broken chain.
- Batter-runner before first is kept as its existing special rule classification, not mislabeled as a generic force out.
- Equal authoritative ticks remain simultaneous; serialization `sequence` never breaks a tie.
- This foundation models **play-start locations plus retirement-driven force dissolution** only.
- Safe advancement that changes a runner's legally occupied base is deferred to a separate base-occupation transition phase; this plan must not guess those transitions.

### Task 1: Initial/current force obligation derivation

Create `ForceObligation.ts`.

State:
- batter-runner participant at virtual base 0;
- optional play-start participants at bases 1, 2, 3;
- active/retired status.

Derivation:
- active batter-runner -> target 1;
- active runner from first is forced to 2 only while the active chain from virtual base 0 through base 1 is intact;
- runner from second is forced to 3 only while bases 0,1,2 remain an active chain;
- runner from third is forced home only while bases 0,1,2,3 remain an active chain.

Tests:
- empty bases: batter only;
- runner on first: batter->1, R1->2;
- runners on first+second: add R2->3;
- bases loaded: add R3->home;
- runner on second with first empty is not forced;
- retiring batter breaks all pre-existing runner forces;
- retiring R1 breaks forces on R2/R3 while batter remains active.

### Task 2: Force-out physical rule

Create `ForceOutRule.ts`.

Input:
- a **current** ForceObligation valid for the evaluated tick;
- defender controlled-target-base contact;
- forced runner target-base touch.

Result:
- defender control strictly first -> force out;
- runner target touch strictly first -> safe at target for this comparison;
- equal tick -> simultaneous;
- missing facts -> unresolved;
- wrong runner/base -> reject.

No global state mutation inside this resolver.

### Task 3: Retirement-driven recomputation vertical slice

Add a pure `retireForceParticipant` operation.

Acceptance:
- play starts runner on first, batter at virtual base 0;
- R1 initially forced to second;
- batter-runner is retired first at first base;
- recomputed state has no force obligation for R1;
- a later controlled second-base contact cannot be submitted as a current force out for R1 because no current obligation exists.

Bases-loaded companion:
- initially R3 is forced home;
- R1 is force-retired at second;
- after retirement, R2 and R3 lose their forces;
- subsequent outs on R2/R3 require another rule path (e.g. tag), not force-base contact alone.

### Task 4: RuleEngine integration boundary

Add helpers so the existing RuleEngine can consume a current force-out result and classify it as `force` for `ThirdOutScoring`.

Do not yet implement every double-play sequence or safe-advancement base transition.

### Task 5: Core API and verification

Export ForceObligation/ForceOutRule from `src/core/index.ts`.
Run local TypeScript and deterministic fixtures.
Retry P0 Core CI; full repository GREEN remains unclaimed unless workflow steps actually run.


---

## Implementation Evidence

Implemented through HEAD `cadce872b0646c17fdbaa81488b00cdd2dc734ca`:
- initial force participant state from canonical base occupancy;
- batter-runner first-base obligation kept distinct from generic `force`;
- contiguous force-chain derivation;
- immutable participant retirement and force recomputation;
- current-obligation-only force-out resolver;
- exact safe/out/simultaneous comparison from authoritative ticks;
- retirement vertical slice proving downstream force dissolution;
- RuleEngine force-out scoring boundary using `classification: 'force'`;
- non-third-out home touches remain pending rather than prematurely finalized;
- shared Core API exports.

Independent verification:
- TypeScript 5.8 source-level rules typecheck: success;
- loaded-bases force chain: batter->1, R1->2, R2->3, R3->home;
- R1 force-out then retirement: R2/R3 forces dissolve;
- force third out suppresses an earlier home touch;
- no `sequence` ordering is used to break same-tick physical ties.

Repository CI:
- P0 Core run `35303189820` at HEAD failed before workflow steps were created;
- full repository GREEN remains intentionally unclaimed while the repository-wide `steps=null` condition persists.
