# World-First Live-Ball Architecture

**Date:** 2026-09-20  
**Status:** AUTHORITATIVE CONTINUOUS DESIGN CONTRACT  
**Scope:** Shared Match Core live-ball, baserunning, fielding, play finalization, official scoring, validation, Mini/Natural observation

## 1. Permanent principle

The Shared Match Core follows one direction of authority:

> **The world moves entities; baseball rules interpret what happened.**

日本語では次を恒久原則とする。

> **野球の結果が選手を動かすのではなく、選手・ボールが正史世界で実際に動いた結果を、野球規則が解釈する。**

Therefore the Core must never model ordinary play as:

```text
single
  -> batter goes to first
  -> runners advance one base
```

or:

```text
double
  -> batter goes to second
  -> fabricate final occupancy
```

The canonical direction is:

```text
Canonical World State
  -> perception / intent / action
  -> physical movement and contact
  -> canonical physical events
  -> rule interpretation
  -> official ruling / scoring description
  -> validation / presentation observers
```

This document is not a new staged roadmap. It is the continuous architecture contract that all remaining live-ball work must obey.

## 2. Authority layers

### 2.1 Canonical World State

The world owns physical truth.

At a minimum it can express:

- ball position, velocity, spin and possession state;
- player position, velocity, orientation and body/contact primitives;
- runner position and motion state;
- bases, boundaries, walls and surfaces;
- exact canonical tick;
- live/dead-ball state and other rule-relevant environment state.

A runner is fundamentally a person in world space, not a value such as "runner on first".

Base occupancy is a baseball interpretation of world/rule history. It is not the primitive that moves the runner.

### 2.2 Perception and intent

Players, coaches, managers and umpires may act from incomplete perceived information.

Examples:

- advance;
- retreat;
- hold;
- slide;
- move toward a coverage point;
- field the ball;
- cover a base;
- relay;
- throw;
- tag;
- appeal.

Intent does not guarantee the result.

A runner intending to reach second may stop before second, reverse, miss a base, overrun a target, be displaced, or continue toward third.

### 2.3 Motion/action controllers

Controllers translate intent into physical world evolution.

Existing abstractions such as:

- `RunnerMotionIntent`;
- `RunnerRoute`;
- `TeamCoveragePlan`;
- `ThrowPlan`;

remain useful, but they are **controllers or plans**, not canonical result authority.

A prebuilt route is transient guidance. It does not own the runner forever.

If the canonical world is changed by collision, re-plan, forced displacement, teleport-like debug effect, or any other discontinuity, future motion must rebase from the new canonical physical state rather than snapping the entity back onto an obsolete route.

### 2.4 Canonical physical events

Rules consume facts that actually happened.

Examples:

- bat-ball contact;
- ground/wall contact;
- glove-ball contact;
- secure possession;
- possession loss;
- throw release;
- reception;
- body/base contact;
- runner/base touch;
- runner leaving a base;
- tag contact;
- ball leaving the field;
- physical displacement;
- dead-ball transition.

Events retain exact ticks and provenance.

### 2.5 Rule interpretation

RuleEngine interprets physical facts and rule state.

It may determine:

- force obligation;
- force dissolution;
- OUT / SAFE / simultaneous / unresolved;
- legal retouch;
- appeal consequences;
- third-out run suppression;
- scoring eligibility;
- awards and dead-ball consequences.

Rules do not rewrite the physical past to manufacture the expected baseball result.

### 2.6 Official ruling

When human umpire/review behavior is modeled, preserve the existing four-layer separation:

```text
Physical Truth
  -> Correct Rule Result
  -> OnFieldCall / Review
  -> Final Official Ruling
```

A wrong call must not rewrite the physical trace.

The official match state may follow the Final Official Ruling when that adjudication layer is enabled, while the underlying Physical Truth and Correct Rule Result remain available for replay/debug/review evidence.

The current bounded production ground-ball slice applies the correct RuleEngine result directly because the umpire/review layer is not yet connected to that coordinator. That implementation shortcut is not a permanent architecture rule.

### 2.7 Official scoring

Official scoring is downstream of physical truth, rule adjudication and—where relevant—the Final Official Ruling.

Examples:

- hit;
- error;
- fielder's choice;
- sacrifice;
- earned/unearned responsibility.

A scoring label must never be used as a locomotion command.

It is valid for the Core to know that a runner physically reached second while official scoring is still unsupported or unresolved.

### 2.8 Validation and Presentation

Validation and Presentation are observers.

They may:

- calculate statistics;
- compare alignments;
- render Mini;
- render Natural;
- replay canonical events;
- inspect causal traces.

They may not:

- move an entity;
- create a base touch;
- decide possession;
- convert a distance bucket directly into a hit in production;
- alter a canonical OUT/SAFE result.

## 3. Runner world model

### 3.1 Position is primary; base labels are derived context

The canonical runner truth is world-space state.

Conceptually:

```ts
type CanonicalRunnerWorldState = {
  playerId: string;
  tick: SimulationTick;
  position: Vec3;
  velocity: Vec3;
  orientation?: Orientation;
  bodyMode: RunnerBodyMode;
};
```

This is the physical layer.

Base-related data belongs to a separate rule/history layer.

Conceptually:

```ts
type RunnerBaseRelation = {
  touchedBases: readonly BaseTouchFact[];
  lastTouchByBase: ReadonlyMap<BaseId, SimulationTick>;
  forceObligations: readonly ForceObligation[];
  retouchRequirements: readonly RetouchRequirement[];
  retiredAt: SimulationTick | null;
  scoredAt: SimulationTick | null;
};
```

The exact type may differ, but the authority separation is mandatory.

### 3.2 Existing `currentBase / nextBase` remains a decision convenience

Existing P6 decision APIs model the common baseball question:

- remain/return at current base;
- advance toward next base.

That remains valid as a **perceived decision context**.

It must not become a universal assertion that the runner physically occupies that base.

For unusual states, the runner may physically be:

- between bases;
- beyond a base;
- off the nominal running line;
- stationary away from every base;
- displaced to a location not reachable by the previous route.

### 3.3 `RunnerRoute` is a replaceable motion plan

`RunnerRoute` remains useful for efficient deterministic movement and exact base-touch solving.

It is not immutable world truth.

A runner controller may:

- continue the current route;
- reverse on it;
- replace it;
- splice a new route from the current world position;
- stop;
- create a new route toward an arbitrary world-space target.

No future official-result API may command "advance N bases".

## 4. Irregular world-state transitions

The architecture must tolerate irregular physical state, even when ordinary baseball never intentionally creates it.

This is important for:

- collisions;
- bad routes;
- overrun;
- rundown;
- missed bases;
- wild throws;
- unusual rebounds;
- future rule variants;
- adversarial testing;
- debug instrumentation.

A debug/test effect may conceptually express:

```ts
type CanonicalWorldEffect =
  | { kind: 'teleport'; entityId: string; position: Vec3 }
  | { kind: 'impulse'; entityId: string; deltaVelocity: Vec3 }
  | { kind: 'freeze_motion'; entityId: string; untilTick: number }
  | { kind: 'forced_reposition'; entityId: string; position: Vec3 };
```

These exact APIs are not required now.

### 4.1 Effect authority and provenance

A generic arbitrary world-effect API must not become a normal production-result input.

Every discontinuous effect must carry provenance/authority sufficient to explain why it exists, conceptually such as:

- `physical_engine`: collision/impulse produced by ordinary simulation;
- `rule_system`: a RuleProfile-authorized dead-ball/award/reposition operation;
- `debug_test`: adversarial instrumentation available only in explicit debug/test execution.

A caller that merely wants a runner to be safe or reach a base may not submit `teleport`, `forced_reposition`, or equivalent world mutation as a shortcut.

Debug/test effects must be impossible to enable accidentally in ordinary production match resolution.

### 4.2 Discontinuous contact semantics

A discontinuous position change does not imply a swept path through the space between old and new positions.

For example:

```text
runner at first-side position
  -> debug teleport
  -> runner physically near third
```

must **not** fabricate a second-base touch merely because a straight line between the two coordinates crosses second.

The effect event must state whether motion was continuous or discontinuous. Only continuous physical motion may generate intermediate collision/base-touch facts from swept geometry.

After a discontinuity, the old motion plan is invalidated and future movement rebases from the exact new canonical state. Historical touch/possession/rule events remain immutable.

The architectural rule is:

```text
world effect
  -> canonical world state changes
  -> physical/world event is recorded
  -> motion controller rebases if needed
  -> RuleEngine interprets subsequent actual facts
```

Never:

```text
teleport runner to second
  -> automatically award second base
```

If a debug effect places a runner on second without touching first, the physical position and base-touch history may disagree. That disagreement is valid canonical evidence for rule/adversarial testing.

## 5. Base touch, occupancy and entitlement

### 5.1 A base is a physical region plus rule meaning

Base touch is a physical event.

Keep two concepts distinguishable:

- **physical/base-relation truth**: where the runner is and which base contacts actually happened;
- **official match participation/occupancy**: which runner remains legally active/placed after applicable rule and umpire/review adjudication.

Occupancy/entitlement is derived from:

- actual touch history;
- force state;
- retouch state;
- runner retirement/scoring;
- applicable RuleProfile;
- Final Official Ruling where human adjudication is modeled.

An official OUT call may retire a runner in official match state without erasing the physical evidence that the runner actually touched first before the tag/control event.

### 5.2 Final occupancy is never injected from result labels

The general production resolver must derive final occupancy.

It must not accept:

- "single -> first occupied";
- "double -> second occupied";
- `advanceBases: 2`;
- caller-supplied `basesAfter` as authoritative production truth.

Compatibility adapters may still accept already-resolved state, but they are not the production simulation authority.

### 5.3 Multiple runners are independent physical actors

Do not resolve multi-runner plays by distributing runners through a result table.

Each runner keeps independent:

- world state;
- perception;
- intent;
- route/controller;
- touch history;
- rule obligations;
- retirement/scoring state.

This allows:

- two runners near one base;
- one runner retreating while another advances;
- rundowns;
- missed bases;
- appeal plays;
- abnormal displacement.

RuleEngine decides the legal consequences.

## 6. Play continuation and PlayEnd

### 6.1 OUT and SAFE are events/results, not automatic PlayEnd

A local OUT or SAFE result does not by itself end live action.

The current no-runner batter-runner-before-first OUT is terminal only because all offensive live actors are retired and no supported action can change the play.

SAFE at first remains live unless a general finalization condition is established.

### 6.2 Simulation horizon is never PlayEnd evidence

A timeline `endTick` means only:

> "the simulation/model was sampled through this tick."

It does not mean:

> "the baseball play ended here."

### 6.3 General finalization is state/action based

A future general live-action finalizer must inspect canonical facts, not a named play bucket.

It must evaluate an **action frontier** that includes more than current velocity. At minimum the frontier must account for:

- in-flight ball/player motion;
- already-issued intents whose motor/reaction delay has not completed;
- scheduled possession/reception/tag/base-contact consequences;
- pending perception/communication updates that can still cause a supported agent to choose a new action in this play;
- unresolved appeal/review/rule windows that the configured RuleProfile treats as part of the current play;
- eligible offensive/defensive actors whose current policy still permits a new action before the next reset/pitch.

A play may be operationally complete when one of the rule/profile-supported completion conditions applies, for example:

- the ball becomes dead by rule;
- a terminal rule event ends the plate appearance/live action;
- all offensive actors relevant to the play are retired or scored;
- surviving runners are physically stabilized and the action frontier proves no supported pending/new action can still change this play;
- defense has stable possession/control where required;
- no scheduled or already-issued supported event at an earlier/equal canonical tick can invalidate finalization.

The exact quiescence/action-frontier policy must be deterministic and RuleProfile-aware.

"Nobody moved for N arbitrary seconds", "all current intents are hold", or "the current trajectory horizon ended" is not sufficient by itself unless the modeled agent/action policy proves that no new play-changing action can still arise.

## 7. Decisions do not own truth

Probabilities and estimates are valid for deciding what to attempt.

Examples:

- perceived out probability;
- predicted arrival time;
- expected extra bases;
- scoring threat;
- manager win-value estimate.

They may choose:

- whether to run;
- where to throw;
- who covers;
- whether to relay.

After the action is selected, physical execution determines what happened.

Changing an advisory probability without changing the selected action must not directly flip the canonical result.

## 8. One continuous implementation frontier

There are no separate "Phase 1 / Phase 2" live-ball architectures.

There is one engine and one continuous capability frontier.

New behavior is added by supporting more physical events, actions and rule consequences while preserving the same authority direction.

Current supported frontier includes:

- the existing P0-P9 foundation;
- physical first-base race evidence;
- a production no-pre-pitch-runner ground-ball force OUT at first;
- one-way production-result -> validation observation.

The same architecture expands continuously to cover, in any implementation order justified by dependencies:

- SAFE continuation;
- stopping/continuing/retreating after first;
- route replacement and arbitrary target movement;
- pre-pitch runners;
- multiple simultaneous runner decisions;
- force transitions;
- double/triple plays;
- tags and rundowns;
- relays;
- wild throws and possession loss;
- dead-ball/award states;
- general PlayEnd/quiescence;
- final occupancy derivation;
- broader official scoring;
- production-derived statistical calibration.

These are capabilities of one system, not separate result engines.

## 9. Existing design preserved

The following existing foundations already satisfy this contract and should not be rewritten without a concrete problem:

- integer canonical simulation time and exact event ticks;
- `CanonicalWorldSnapshot`;
- physical ball flight;
- contact vs secure possession separation;
- defender physical primitives;
- individual runner perception and decisions;
- `RunnerMotion` deterministic physical latency;
- `RunnerRoute` as a motion geometry tool;
- arbitrary defensive alignment coordinates;
- `TeamCoveragePlan`;
- physical throw/reception;
- physical tag/base contact;
- RuleEngine separation;
- Physical Truth / Correct Rule Result / OnFieldCall / Official Ruling separation;
- Presentation isolation;
- P9 validation-only bucket isolation;
- fixed-seed determinism.

## 10. Existing implementation constraints that are not permanent architecture

The current code has intentionally bounded implementation assumptions.

They are not promoted to design law:

- `RunnerKnownContext.currentBase / nextBase` assumes normal adjacent-base decisions;
- `RunnerMotionIntent` uses advance/retreat/hold/slide;
- `RunnerMotionState` advances along a prebuilt route-distance axis;
- `BatterRunnerWorldTimeline` owns one prebuilt post-launch trajectory over its configured interval;
- the current production ground-ball coordinator refuses pre-pitch runners;
- SAFE-at-first does not yet finalize;
- the current production supported official classification is only `batter_runner_out_before_first`;
- throw release currently uses the documented `throwReadyTick` approximation.

Future implementation may generalize these boundaries without changing the authority model.

## 11. Adversarial invariants

The architecture must survive these cases without inventing results:

- runner reaches first and remains there indefinitely;
- runner reaches first and immediately tries for second;
- runner reverses twice in a rundown;
- runner stops between bases;
- runner misses a base;
- runner is displaced off the nominal route;
- ball changes direction after a failed catch;
- throw misses every intended receiver;
- two runners converge near the same base;
- runner is debug-teleported near second without touching first;
- runner receives an impulse opposite the planned route;
- a motion controller's old route becomes invalid after a world discontinuity;
- Presentation is disabled;
- validation classifier is removed;
- official scoring is unsupported.

For every case:

1. world state remains representable;
2. canonical physical events remain recordable;
3. RuleEngine may resolve what it has sufficient facts to resolve;
4. unsupported interpretation remains explicit;
5. no result bucket moves the entities.

## 12. Design test

Before adding any new live-ball API, ask:

> If an entity were suddenly somewhere unexpected in the field, would this API still read the actual canonical world and continue correctly, or would it try to force the entity back into a preselected baseball result?

If the second answer is possible, the API is too result-driven.

A second test is:

> Can Presentation, statistics, official scoring, or a desired outcome change physical movement without issuing a legitimate world/action command?

If yes, the authority boundary is broken.

## 13. Adversarial reconciliation audit — 2026-09-20

The unified contract was attacked after reconciliation with the existing plans.

### Finding W-1 — HIGH — arbitrary world-effect could become outcome injection

**Attack:** a flexible teleport/forced-reposition API could let production callers bypass physics and manufacture desired base outcomes.

**Resolution:** every discontinuous effect requires explicit authority/provenance; debug/test effects are not ordinary production match inputs; a desired SAFE/base result is never sufficient authority for a world mutation.

### Finding W-2 — HIGH — teleport could fabricate intermediate base touches

**Attack:** projecting a discontinuous old->new position as a continuous segment could accidentally generate touches/collisions through every crossed region.

**Resolution:** discontinuities explicitly have no swept path. Intermediate contacts are generated only by continuous motion. Historical touch facts remain immutable and future motion rebases from the destination state.

### Finding W-3 — HIGH — quiescence could end a play before delayed decisions arrive

**Attack:** zero velocity or current `hold` intents do not prove that a coach signal, perception update, reaction-delayed intent, pending throw, or appeal can no longer change the play.

**Resolution:** PlayEnd must consult an explicit action frontier covering in-flight physics, delayed intents, pending perception/communication/decision work, rule windows and actor eligibility.

### Finding W-4 — MEDIUM — official ruling and official scoring were too closely grouped

**Attack:** grouping them can obscure the case where Physical Truth / Correct Rule Result differs from an umpire/review Final Official Ruling.

**Resolution:** the layers are now separate. Official match state may follow Final Official Ruling when enabled; official scoring describes the adjudicated play and still cannot rewrite physical truth.

### Finding W-5 — MEDIUM — physical base relation and official occupancy can diverge

**Attack:** an erroneous OUT call or appeal can retire a runner officially while the physical trace still shows a base touch.

**Resolution:** physical/base-relation truth and official participation/occupancy are explicitly distinct.

### Residual implementation risks

No known HIGH-severity design contradiction remains.

The current implementation still lacks:

- a general runner route-rebase orchestrator;
- arbitrary-target/free world-space runner locomotion beyond the current route-distance model;
- an action-frontier/general PlayEnd implementation;
- multi-runner production orchestration;
- umpire/review integration in the new production ground-ball coordinator;
- broad official scoring.

These are implementation gaps of the same architecture, not reasons to create separate result engines.

## 14. Short form

```text
WORLD
  owns where things are

INTENT / ACTION
  tries to change the world

PHYSICAL EVENTS
  record what actually happened

RULES
  interpret those events

OFFICIAL RULING
  applies umpire/review adjudication when modeled without erasing truth

OFFICIAL SCORING
  describes the completed adjudicated/physical outcome

VALIDATION / PRESENTATION
  observe everything above
```

That direction is permanent.