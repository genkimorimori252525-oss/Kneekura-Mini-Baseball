# Canonical Live-Ball Outcome Resolution — Post-Roadmap Plan

**Date:** 2026-09-19  
**Branch:** `jolly/core-realism-2026-09-18`  
**Starting HEAD:** `5d9e1dfa162fc466bf924d50f7bf82e0d3b62ef4`  
**Durable workflow:** `04286db135aa47d1b3b57f1834ba943e`

## 1. Parent objective

The P0-P9 foundation is complete. The next Core objective is to remove the remaining gap between causal physical simulation and final live-ball results.

The production direction is:

```text
contact
  -> ball state through time
  -> defender perception / assignment / movement
  -> catch / pickup / possession
  -> throw / relay / tag / controlled-base contact
  -> runner decision / movement / base touch
  -> RuleEngine adjudication
  -> authoritative play end
  -> final bases / outs / runs
  -> official result classification
  -> match-state application
```

Never:

```text
distance bucket / presentation state / desired statistics
  -> single / double / triple / out
  -> fabricate final bases and runs
```

Official classification is a description of an already-resolved play. It does not drive the physical play.

## 2. Existing authoritative foundations to preserve

The implementation must reuse, not replace, the existing foundations:

- `CanonicalWorldSnapshot` for presentation-observable world state.
- canonical plate-appearance timeline and exact event time.
- physical contact and batted-ball state.
- `DefenderMotion` and defender physical primitives.
- `TeamCoveragePlan` and individual defensive intent.
- `CoverageThrowExecution`, throw launch, accelerated reception, catch retention, and controlled-base contact.
- `RunnerMotion`, routes, body contact, and exact base-touch timing.
- `FirstBasePhysicalRace` for reception -> possession -> defender control versus batter-runner touch.
- `RuleEngine` for first-base, force-out, tag-out, third-out scoring, appeals, and pending-run finalization.
- `PlateAppearanceMatchState` for applying an already-resolved live-ball play.
- P9 fingerprints, presentation-isolation tests, and deterministic validation infrastructure.

No new subsystem may re-implement OUT/SAFE, third-out scoring, force dissolution, tag timing, or existing catch semantics.

## 3. Current authority gaps

### 3.1 Caller-supplied final bases

`completeGroundBallFirstBasePlateAppearance` currently accepts `basesAfter` from its caller.

That is acceptable as a narrow adapter, but it is not a complete causal production path. A new production resolver must derive final occupancy from runner facts and rule outcomes.

### 3.2 Caller-supplied play end

The same coordinator accepts `PlayEndFact` from its caller.

`PlayRunFinalization` correctly refuses to decide when a play ends, but the production simulation still needs an authoritative live-action completion policy. The first vertical slice must create play end only after no supported runner/defender action can still change the supported play state.

### 3.3 Validation-only outcome buckets

`P9BatchCalibration` deliberately maps reach evidence to out/single/double/triple buckets. This remains validation-only.

The new production path must not import that classifier or its thresholds. P9 can consume production outcomes later, but production cannot consume P9 classifications or target statistics.

### 3.4 Advisory probabilities versus authoritative truth

`ThrowPlan` contains `outProbability`, scoring-threat probabilities, and expected-extra-base estimates.

These are legal as defender decision inputs. They are forbidden as final-out, final-base, final-run, or official-result facts. After a throw is selected, actual launch/reception/possession/touch/tag evidence must determine the result.

### 3.5 General play-result classification is incomplete

The Core can already resolve important local rules and apply a resolved live-ball state, but there is no single general production object that preserves the causal evidence while expressing the final supported play result.

The new boundary must fill this orchestration gap without turning classification into a simulation input.

## 4. Authority model

The new path separates five layers.

### Layer A — Physical evidence

Examples:

- ball trajectory/contact/pickup/reception;
- catch-retention outcome;
- defender body/base contact;
- controlled runner tag;
- runner base touch/departure;
- exact event ticks.

These facts may be stochastic only through the existing deterministic RNG streams.

### Layer B — Decision evidence

Examples:

- defender intent;
- team coverage assignment;
- selected throw candidate;
- runner advance/retreat intent.

Predictions and probabilities are allowed here as beliefs used to choose an action. They do not become physical facts.

### Layer C — Rule adjudication

Existing RuleEngine functions consume Layer A facts and produce legal OUT/SAFE/scoring consequences.

Rule semantics are not duplicated in the outcome resolver.

### Layer D — Play finalization

Once no supported live action can change the play:

- emit one authoritative `PlayEndFact`;
- finalize pending runs;
- derive final base occupancy from surviving/scored/retired runner evidence;
- produce the canonical production outcome record.

### Layer E — Descriptive official classification

Only after A-D are fixed may the Core describe the play as supported categories such as:

- batter-runner out before first;
- batter reaches first safely;
- later expansion: single/double/triple/home run, force play, fielder's choice, error, etc.

Unsupported scoring categories must be represented as unclassified/unsupported, never guessed.

## 5. Proposed canonical production boundary

Initial name:

`CanonicalLiveBallOutcome`

The exact TypeScript shape may evolve during implementation, but the authority requirements are fixed.

It should contain:

- `playEnd`;
- `outsAfter`;
- `basesAfter`;
- `scoredRunnerIds`;
- evidence references or preserved evidence bundle sufficient to explain the result;
- a supported descriptive classification that cannot be used to recompute physical truth.

It must not contain editable probability fields that can override resolved facts.

A separate orchestration result may carry:

- physical evidence;
- decision evidence;
- rule decisions;
- final outcome.

This preserves explainability and adversarial auditability.

## 6. First bounded vertical slice

Do not attempt all baseball at once.

The first production slice is:

**ordinary fair ground ball with a batter-runner race to first base, with no pre-pitch runners.**

Why this slice:

- it already has the strongest physical/rule foundation;
- no caller-supplied final base occupancy is necessary;
- it can prove the new authority boundary with minimal new semantics;
- it avoids falsely claiming complete baserunner, error, or official-scoring coverage.

Required causal chain:

```text
fair ground-ball evidence
  -> designated ball handler / supported pickup state
  -> selected first-base throw
  -> physical throw launch
  -> physical reception + retention
  -> receiver controlled-base contact
  -> batter-runner physical first-base touch
  -> existing first-base RuleEngine
  -> OUT or SAFE
  -> derived empty/first-base occupancy
  -> authoritative play end
  -> CanonicalLiveBallOutcome
  -> PlateAppearanceMatchState
```

For this first slice:

- OUT => batter-runner retired, bases empty.
- SAFE => batter-runner occupies first.
- simultaneous/unresolved => the play must remain unresolved; never guess.
- failed reception/retention => no artificial defender control fact; the bounded slice may remain unresolved until a supported continuation exists.

The initial slice does **not** manufacture a single if the defense fails. A later slice will model live-ball continuation and extra-base advancement before descriptive hit classification is expanded.

## 7. Play-end rule for the first slice

The hardest authority risk is premature play end.

For the bounded no-runner first-base race, play end may be emitted only when:

1. the existing RuleEngine has a resolved first-base result; and
2. the supported runner state is terminal for the bounded slice; and
3. no already-scheduled supported physical event at an earlier/equal canonical tick can change that result.

If any of these conditions are not satisfied, no `PlayEndFact` is created.

The general future live-ball play-end policy must handle additional runners, relays, tags, dead balls, and voluntary stopping. That is explicitly deferred.

## 8. Final-base derivation rule for the first slice

Final occupancy is derived from the resolved physical/rule result:

- first-base OUT -> no batter-runner occupancy;
- first-base SAFE -> batter-runner at first;
- unresolved/simultaneous -> no final occupancy is published.

The resolver must not accept `basesAfter` as input for this production entry point.

Existing lower-level adapters that accept `basesAfter` may remain for compatibility/tests, but they are not the authoritative new production entry point.

## 9. Official-result boundary

The first slice should use a narrow descriptive classification such as:

- `batter_runner_out_before_first`
- `batter_runner_safe_at_first`

Do not yet label every safe result as an official single. A safe-at-first result can later depend on error/fielder's-choice/other scoring evidence.

This prevents the new architecture from recreating the old validation shortcut under a more official-sounding name.

## 10. Adversarial audit circuit

Adversarial audit is a repeated gate, not a final review.

### Gate A — design audit

Attack:

- caller-injected `basesAfter`;
- caller-injected or premature `PlayEndFact`;
- use of P9 distance buckets in production;
- use of `ThrowPlan.outProbability` as an actual out;
- double application of runs;
- rule duplication;
- impossible/duplicate base occupancy;
- ambiguous equal-tick ordering;
- hidden Presentation input;
- nondeterministic iteration or unstable tie-breaks.

No implementation begins with unresolved high-severity findings.

### Gate B — implementation audit

Hostile tests must include:

- defender control before runner touch;
- runner touch before defender control;
- exact equal tick;
- no reception;
- retention failure;
- mismatched physical clocks;
- duplicate/inconsistent runner occupancy attempts;
- attempts to inject Presentation/validation state;
- deterministic same-seed replay;
- third-out scoring when runners are introduced in the next slice.

All high-severity defects are fixed before expansion.

### Gate C — closure audit

Before calling the phase complete:

- replay the authority map against actual code;
- verify that classification remains downstream-only;
- verify P9 and Presentation isolation;
- verify unsupported outcomes remain explicit;
- review every new API for outcome injection;
- record remaining medium/low risks.

## 11. Implementation phases

### Phase 1 — authority-preserving outcome model

Add the minimal canonical outcome/evidence types and invariants. No broad official scoring yet.

### Phase 2 — no-runner ground-ball production coordinator

Compose existing physical first-base race + RuleEngine + causal final-base derivation + bounded play end + match-state application.

### Phase 3 — adversarial hardening

Add hostile fixtures and remove any hidden caller authority discovered by Gate B.

### Phase 4 — occupied-base extension

Introduce pre-pitch runners one bounded case at a time using existing runner decisions/motion, force/tag rules, home-touch facts, and pending-run finalization.

Do not use a generic "advance N bases because result=double" rule.

### Phase 5 — production statistics bridge

Map completed production outcomes into `BatchValidationStatistics` only after the supported production result exists.

Statistics are observers. They cannot feed back into Core resolution.

### Phase 6 — later official scoring

Hit/error/fielder's-choice classification is a downstream scorer consuming completed physical/rule evidence. It is not required to complete the first causal slice.

## 12. Explicit deferrals

The first implementation does not claim:

- complete fly-ball/touch-up orchestration;
- complete relay/rundown orchestration;
- complete multi-runner collision/path conflict handling;
- official hit/error/fielder's-choice scoring;
- inside-the-park home-run semantics;
- all dead-ball awards;
- league-calibrated probabilities;
- Natural rendering work.

These are added only after the production causal boundary is proven.

## 13. Verification contract

Every implementation increment must preserve:

- deterministic same-input/same-seed behavior;
- existing fixed-seed P9 fingerprints unless an intentional evidence-format/version migration is documented;
- renderer OFF/Mini/Natural isolation;
- no wall-clock simulation input;
- no Presentation -> Core dependency;
- full `npm run verify` success before closure.

The self-hosted CI run and exact source SHA are part of closure evidence.

## 14. Stop condition

This work is not complete merely because a new result enum exists.

The first milestone is complete only when a real supported ground-ball play reaches match-state application without the caller supplying:

- the final base occupancy;
- the final out/safe result;
- a statistical hit bucket.

The physical/rule chain must be able to explain why the final state exists.