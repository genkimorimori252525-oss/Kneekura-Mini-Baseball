# World-First Runtime Contracts

**Date:** 2026-09-20  
**Status:** IMPLEMENTATION-READY DESIGN CONTRACT  
**Governing principle:** `docs/game-design/05-world-first-live-ball-architecture.md`

This document refines the world-first architecture into concrete runtime contracts.

It does not create a second live-ball engine and it does not define product phases.

The existing deterministic primitives remain valid where explicitly reused.

---

## 1. Live-play authority split

During live action, the following authority order applies:

```text
CanonicalWorldSnapshot / canonical event history
        ↓
controller state + perception / intent
        ↓
continuous or discontinuous world transition
        ↓
physical rule facts
        ↓
RuleEngine interpretation
        ↓
ActionFrontier finalization
        ↓
official between-play ledger
```

`CanonicalMatchState.bases` is the official **between-play ledger**.

It is authoritative for who begins the next pitch occupying first/second/third.

It is not the live physical location of those runners while a ball is in play.

At live-ball start:

```text
CanonicalMatchState.bases
        ↓
instantiate runner world actors + initial base-relation history
```

At live-ball end:

```text
canonical world + event history + rule/adjudication state
        ↓
derive final legal runner participation / base claims
        ↓
CanonicalMatchState.bases for the next play
```

No live controller may move a runner by editing `CanonicalMatchState.bases`.

---

## 2. Canonical runner actor

### 2.1 Kinematic truth

The long-term authoritative live-runner state is world-space kinematics.

Conceptually:

```ts
type CanonicalRunnerKinematics = Readonly<{
  playerId: string;
  tick: number;
  position: Vec2;
  velocity: Vec2;
  bodyMode: 'upright' | 'sliding';
  motionRevision: number;
}>;
```

The exact production type may extend the existing `BaserunnerWorldState`.

Requirements:

- `position` and `velocity` are canonical physical truth.
- `motionRevision` increases whenever previously planned future motion becomes invalid.
- no `currentBase`, `nextBase`, hit result, or official-scoring label owns physical position.
- one runner id has one authoritative kinematic state at a canonical tick.

### 2.2 Rule/base relation is separate

Each live runner also has rule/history state derived from events.

Conceptually:

```ts
type LiveRunnerRelation = Readonly<{
  runnerId: string;
  touches: readonly RunnerBaseTouchFact[];
  departures: readonly RunnerBaseDepartureFact[];
  forceState: RunnerForceState;
  retouchState: RunnerRetouchState;
  participation:
    | { kind: 'active' }
    | { kind: 'retired'; tick: number; causeId: string }
    | { kind: 'scored'; tick: number; causeId: string };
}>;
```

This relation does not determine where the body is.

A runner may physically stand near second while the relation shows that first was never touched.

That mismatch is valid evidence.

---

## 3. Locomotion controller envelope

Existing `RunnerMotion` and `RunnerRoute` remain the preferred deterministic executor for ordinary baseball running.

They sit inside a more general controller envelope.

Conceptually:

```ts
type RunnerLocomotionController =
  | RouteFollowingController
  | FreeKinematicController
  | StationaryController;
```

### 3.1 RouteFollowingController

Conceptually:

```ts
type RouteFollowingController = Readonly<{
  kind: 'route_following';
  controllerRevision: number;
  basis: RunnerControllerBasis;
  route: RunnerRoute;
  motion: RunnerMotionState;
  parameters: RunnerMotionParameters;
  activeIntent: RunnerMotionIntent;
}>;
```

This controller reuses the existing:

- `RunnerMotion`;
- `RunnerRoute`;
- `RunnerWorldProjection`;
- `RunnerBaseTouch`.

It is valid only while its basis still matches canonical world truth.

### 3.2 Controller basis

Every future trajectory/controller is bound to the canonical state from which it was created.

Conceptually:

```ts
type RunnerControllerBasis = Readonly<{
  tick: number;
  motionRevision: number;
  position: Vec2;
  velocity: Vec2;
}>;
```

Before a controller publishes a sample as canonical truth, the orchestrator must prove:

- same runner;
- same basis tick;
- same motion revision;
- basis position/velocity equal the canonical state within fixed deterministic tolerances.

A stale controller fails closed.

It may not snap the runner back to its old route.

### 3.3 FreeKinematicController

This is a bounded compatibility mechanism for states that existing one-dimensional route motion cannot represent exactly.

Examples:

- lateral impulse;
- collision displacement;
- unusual rebound/contact with another actor;
- arbitrary debug/test initial state;
- transition interval before a new route is acquired.

Conceptually:

```ts
type FreeKinematicController = Readonly<{
  kind: 'free_kinematic';
  controllerRevision: number;
  basis: RunnerControllerBasis;
  acceleration: Vec2;
  validThroughTick: number;
  provenance: WorldTransitionProvenance;
}>;
```

This controller is not permission to create arcade movement.

Normal runner AI should prefer route-following.

Free kinematics exists so the world can represent reality when the route abstraction is temporarily insufficient.

### 3.4 StationaryController

A stationary runner is explicitly modeled, not inferred from a missing route.

Conceptually:

```ts
type StationaryController = Readonly<{
  kind: 'stationary';
  controllerRevision: number;
  basis: RunnerControllerBasis;
  settledIntentId: string | null;
}>;
```

Stationary does **not** imply PlayEnd.

---

## 4. Rebase contract

A rebase replaces future motion ownership while preserving physical/event history.

### 4.1 Rebase triggers

A rebase is required when any of these invalidates the active controller:

- runner decision chooses a materially different route;
- rundown reverses direction beyond what the current route can represent;
- collision or physical effect changes position/velocity off-route;
- discontinuous world transition occurs;
- rule-authorized reposition occurs;
- old route ends while the live play continues;
- controller basis no longer matches canonical state.

### 4.2 Rebase operation

Conceptually:

```text
canonical runner state at tick T
  + new motion/intent target
        ↓
invalidate controller revision N
        ↓
motionRevision N+1
        ↓
construct controller from exact position/velocity at T
        ↓
future samples may begin at T, never before T
```

Rebase invariants:

1. past world/event history is immutable;
2. no old future sample after T remains authoritative;
3. the new controller begins from exact canonical state at T;
4. no base touch/tag/collision is invented merely because old/new routes differ;
5. same-tick replacement uses deterministic event sequence for controller ownership, while rule-significant physical simultaneity is preserved.

### 4.3 Route acquisition from arbitrary state

A future route planner may generate a new route toward:

- a base;
- a retreat base;
- a coach-selected waypoint;
- an arbitrary legal world-space target;
- a safe avoidance point in a rundown.

The generated route must begin at the exact canonical position.

If canonical velocity is not tangent-compatible with the route, the system must not silently discard lateral velocity.

Allowed approaches:

- a short `free_kinematic` transition before route capture;
- a route whose initial tangent matches current velocity;
- a deterministic transition primitive specifically designed to rotate/brake motion.

The first implementation should prefer the smallest solution that preserves exact state rather than inventing a broad steering engine.

---

## 5. World transition contract

Every canonical state change is either continuous or discontinuous.

Conceptually:

```ts
type WorldTransitionContinuity =
  | { kind: 'continuous' }
  | { kind: 'discontinuous' };

type WorldTransitionProvenance =
  | { kind: 'physical_engine'; sourceId: string }
  | { kind: 'rule_system'; ruleId: string }
  | { kind: 'debug_test'; fixtureId: string };
```

### 5.1 Continuous transition

Continuous transition:

- has an actual path through world space;
- may generate swept collision/contact/base-touch facts;
- may be sampled/intersected between start/end ticks.

Examples:

- running;
- thrown ball flight;
- sliding;
- collision response with continuous post-contact trajectory.

### 5.2 Discontinuous transition

Discontinuous transition:

- changes state at one authoritative tick;
- has no implicit path between old/new position;
- generates no intermediate base touches/tags/collisions;
- invalidates motion controllers that no longer match.

Examples:

- debug teleport;
- test forced reposition;
- explicit RuleProfile award/reset if represented spatially rather than only in the between-play ledger.

### 5.3 Production authority

`debug_test` transitions must be unavailable in normal production match resolution.

A desired result is never valid provenance.

Illegal:

```text
want runner safe at second
  -> teleport to second
```

Legal:

```text
debug fixture tests missed-base handling
  -> debug_test discontinuity to near second
  -> no automatic base touch
  -> RuleEngine sees actual event history
```

---

## 6. Base-contact ledger

Base touch/departure facts are append-only canonical history.

Minimum facts:

- runner/base touch;
- runner/base departure;
- rule-authorized base award when an award exists;
- runner retirement;
- runner score recognition/adjudication.

Do not mutate an old touch because a later ruling changes the official result.

### 6.1 Physical touch versus awarded entitlement

A rule award is not a fake physical touch.

Keep them distinct.

Conceptually:

```ts
type RunnerBaseAcquisition =
  | { kind: 'physical_touch'; fact: RunnerBaseTouchFact }
  | { kind: 'rule_award'; runnerId: string; base: BaseballBase; tick: number; ruleId: string };
```

This allows walks/dead-ball awards to update official between-play occupancy without pretending a live running trajectory existed.

Presentation may optionally animate an awarded runner walking to the base, but that animation cannot become the source of the award.

### 6.2 Base claims

A surviving runner can make a final base claim only from rule-supported evidence.

Conceptually:

```ts
type RunnerBaseClaim = Readonly<{
  runnerId: string;
  base: 1 | 2 | 3;
  basis:
    | { kind: 'physical_touch'; touchTick: number }
    | { kind: 'rule_award'; awardTick: number; ruleId: string };
}>;
```

A claim is not final occupancy until conflicts/entitlement are resolved.

---

## 7. Multi-runner contract

Each runner is an independent live actor.

The orchestrator holds a deterministic runner map keyed by runner id.

No algorithm may "advance all runners according to the batter result".

### 7.1 Independent state

For each active runner, preserve:

- canonical kinematics;
- locomotion controller;
- perceived world;
- decision state;
- base touch/departure history;
- force/retouch obligations;
- participation state;
- pending actions.

### 7.2 Shared interactions

Multi-runner behavior emerges through shared world/rule facts:

- one runner's advance may create/dissolve another's force;
- two runners may approach the same base;
- a defender chooses among multiple throw/tag targets;
- an out may alter later run scoring;
- a trailing runner may affect entitlement without changing another runner's physical coordinates.

### 7.3 Occupancy conflict is a rule problem

Two active runners may physically be near or touching the same base.

Do not reject the world state merely because `BaseOccupancy` cannot represent it.

Before between-play ledger creation, a rule/adjudication resolver must reduce the live evidence to a legal official state.

If it cannot yet resolve the case, finalization is unsupported/unresolved.

It must not choose a runner by array order or overwrite.

---

## 8. Final occupancy derivation

`BaseOccupancy` remains a compact official ledger for the next play.

It is created only after live action is finalizable.

Derivation input:

```text
active/retired/scored runner participation
+ touch/departure/award history
+ force/retouch state
+ Final Official Ruling when applicable
+ resolved base-entitlement conflicts
```

Derivation output:

```ts
type FinalRunnerLedger = Readonly<{
  bases: BaseOccupancy;
  scoredRunnerIds: readonly string[];
  retiredRunnerIds: readonly string[];
}>;
```

Required invariants:

- one runner cannot occupy two official bases;
- one official base cannot contain two runners;
- scored/retired runners do not occupy a next-play base;
- every surviving active runner is either assigned exactly one supported official base or finalization remains unresolved;
- the ledger does not move physical actors retroactively.

---

## 9. Action frontier

PlayEnd is produced by a dedicated finalizer that inspects all still-relevant live work.

Conceptually:

```ts
type LiveActionFrontier = Readonly<{
  tick: number;
  physical: readonly PendingPhysicalWork[];
  intents: readonly PendingIntentWork[];
  information: readonly PendingInformationWork[];
  decisions: readonly PendingDecisionWork[];
  ruleWindows: readonly PendingRuleWindow[];
  actors: readonly ActorPlayDisposition[];
  eventQueueSettledThroughTick: number;
}>;
```

### 9.1 Pending physical work

Examples:

- ball in flight/rolling where a supported future contact remains possible;
- runner/defender continuous motion already committed;
- throw/reception/tag sequence in progress;
- retention/control transition not yet resolved.

### 9.2 Pending intent work

Examples:

- runner intent issued but motor reaction tick not reached;
- defender throw selected but release/transfer not executed;
- relay/appeal action committed but not executed.

### 9.3 Pending information work

Only information already causally in flight can block finalization.

Examples:

- coach communication sent and scheduled to arrive;
- observation sample already scheduled from a visible event;
- review/umpire evidence collection already initiated.

A hypothetical future observation that has not been caused does not block forever.

### 9.4 Pending decision work

Each relevant actor has explicit play disposition:

```ts
type ActorPlayDisposition =
  | { kind: 'acting' }
  | { kind: 'decision_pending'; dueTick: number }
  | { kind: 'waiting_on_pending_trigger'; triggerId: string }
  | { kind: 'settled_for_play'; settledAt: number; basisEventId: string };
```

An actor becomes `settled_for_play` only through its policy/decision system.

Zero velocity does not imply settled.

A runner standing on first may be stationary but still `decision_pending` about second.

### 9.5 Rule windows

RuleProfile may keep the play open for supported:

- appeal attempts;
- dead-ball award completion;
- review/challenge flow where modeled as part of current play;
- other explicit rule windows.

Do not invent generic timeouts.

### 9.6 Event queue watermark

The finalizer may emit PlayEnd at tick T only after canonical event processing proves:

```text
all events with authoritative time <= T
have been generated, sequenced, and consumed by relevant rules/controllers
```

Call this the event queue watermark.

This prevents a same-tick event from appearing after PlayEnd and changing the result.

---

## 10. PlayEnd decision

A dedicated result should carry evidence even if the existing public `PlayEndFact` stays small.

Conceptually:

```ts
type PlayEndResolution =
  | {
      kind: 'ended';
      playEnd: PlayEndFact;
      frontier: LiveActionFrontier;
      reason:
        | 'dead_ball'
        | 'all_offense_terminal'
        | 'action_frontier_empty';
    }
  | {
      kind: 'continues';
      frontier: LiveActionFrontier;
      blockers: readonly PlayEndBlocker[];
    };
```

### 10.1 Terminal exits

Immediate/explicit terminal conditions may end action when RuleProfile allows:

- dead ball;
- all offensive live actors retired/scored;
- another terminal rule event.

Even then, same-tick event watermark/rule consequences must be settled first.

### 10.2 Quiescent live-ball exit

A live ball may be operationally complete only when:

- no pending physical work;
- no committed intent waiting to execute;
- no causally in-flight information that can change the play;
- no decision pending for a relevant actor;
- no open supported rule window;
- all relevant actors are `settled_for_play`;
- event queue is settled through the proposed PlayEnd tick.

This models the practical end of a play without pretending the baseball itself necessarily became dead.

### 10.3 Simulation horizon prohibition

A configured trajectory/timeline end is never a blocker-free frontier by itself.

If a model runs out of supported future horizon before the frontier empties:

```text
result = live_ball_continues / unsupported horizon
```

not PlayEnd.

---

## 11. Determinism

All maps/sets that can affect action choice or finalization must have stable ordering.

Preferred tie-break sources:

1. exact canonical event time;
2. explicit event sequence where simultaneity semantics permit ordering;
3. stable player/entity id;
4. stable rule/action id.

Never depend on:

- JavaScript object insertion order from external inputs;
- renderer update order;
- array order from nondeterministic discovery;
- wall clock.

Same input/seed/Core version must produce the same:

- rebase points;
- controller revisions;
- base relation history;
- action frontier;
- PlayEnd tick;
- final official ledger.

---

## 12. Compatibility with current code

Keep:

- `CanonicalWorldSnapshot`;
- `BaserunnerWorldState`;
- `RunnerMotion`;
- `RunnerRoute`;
- `RunnerWorldProjection`;
- `RunnerBaseTouch`;
- `RunnerDecision`;
- `RundownDecision`;
- `PhysicalRuleFacts`;
- existing RuleEngine functions;
- `PlayRunFinalization`;
- `CanonicalMatchState.bases` as the between-play ledger.

Generalize above them:

```text
RunnerActor / controller envelope
RunnerControllerBasis + revision/rebase
WorldTransition continuity/provenance
LiveRunnerRelation / append-only base history
MultiRunnerLiveState
ActionFrontierFinalizer
FinalRunnerLedger derivation
```

Do not rewrite the proven analytic `RunnerMotion` equations merely to obtain architectural generality.

---

## 13. Implementation seam recommendation

The smallest dependency-ready code seam after this design is:

```text
Canonical runner kinematics
+ controller basis/revision
+ route-following adapter
+ explicit rebase operation
```

It can be introduced while keeping the current no-runner ground-ball production outcome unchanged.

Acceptance for that seam should prove:

- normal existing route replay is byte/fingerprint equivalent;
- rebase at tick T invalidates old future samples after T;
- new route begins from exact canonical state at T;
- discontinuous rebase creates no swept base touch;
- stale controller revision is rejected;
- Presentation and RuleEngine outputs are unchanged for plays with no rebase.

The general PlayEnd/multi-runner orchestrator should consume this seam rather than inventing a second locomotion model.