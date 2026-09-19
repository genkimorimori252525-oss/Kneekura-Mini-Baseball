# Canonical Live-Ball Outcome Resolution — Post-Roadmap Plan

**Date:** 2026-09-19  
**Branch:** `jolly/core-realism-2026-09-18`  
**Starting HEAD:** `5d9e1dfa162fc466bf924d50f7bf82e0d3b62ef4`  
**Durable workflow:** `04286db135aa47d1b3b57f1834ba943e`  
**World-first governing contract:** `docs/game-design/05-world-first-live-ball-architecture.md`  
**World-first runtime contract:** `docs/game-design/06-world-first-runtime-contracts.md`  
**Adjudication/closure contract:** `docs/game-design/07-world-first-adjudication-contracts.md`

This plan records the first causal production milestone. Future expansion follows the single continuous world-first contract; the milestone sections below do not define separate result engines.

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

The first production slice is deliberately narrower after adversarial review:

**ordinary fair ground ball, no pre-pitch runners, ending in a physically supported force out of the batter-runner at first.**

The first milestone does not finalize a SAFE-at-first play. SAFE is a valid first-base race result, but it is not by itself an authoritative end-of-play fact because the batter-runner could still advance and the defense could still act.

Why this slice:

- it already has the strongest physical/rule foundation;
- no caller-supplied final base occupancy is necessary;
- it can prove the new authority boundary with minimal new semantics;
- it avoids falsely claiming complete baserunner, error, or official-scoring coverage.

Required causal chain:

```text
fair ground-ball flight/roll evidence
  -> defender perceived/assigned ball-handler action
  -> physical glove/ball contact on the live batted ball
  -> catch-retention / secure ground-ball possession
  -> rated transfer timing
  -> internally derived throw-launch tick
  -> selected first-base throw
  -> physical throw launch
  -> physical reception + retention
  -> receiver controlled-base contact
  -> batter-runner physical first-base touch
  -> existing first-base RuleEngine
  -> terminal OUT before first
  -> derived empty occupancy
  -> authoritative play end
  -> CanonicalLiveBallOutcome
  -> PlateAppearanceMatchState
```

There is currently no single production ground-ball-pickup orchestrator. Phase 2 must close that gap by composing existing live-ball/glove contact and catch-retention primitives; it must not accept an injected pickup/possession tick.

There is also no complete throwing-arm constraint model. The production coordinator must not accept a raw release tick from its public input. It must derive the launch boundary from secure possession and existing rated transfer timing. Until a full hand/arm constraint model exists, using `throwReadyTick` as the launch tick is an explicit zero-duration ready-to-release approximation, not hidden caller authority.

For this first slice:

- physically secured first-base force OUT => batter-runner retired, bases empty, terminal play;
- SAFE => first-base race evidence is preserved, but no `PlayEndFact`, final occupancy, or completed plate appearance is published yet;
- simultaneous/unresolved => the play remains unresolved; never guess;
- failed ground-ball possession, throw reception, or retention => the ball remains live and the bounded slice does not manufacture a result.

The initial slice does **not** manufacture a single if the defense fails or the runner is safe. A later continuation slice must model subsequent runner/defender action before final occupancy and descriptive hit classification are expanded.

## 7. Play-end rule for the first slice

The hardest authority risk is premature play end.

For the first milestone, play end may be emitted only for the terminal no-runner force-out case.

Required conditions:

1. the existing RuleEngine resolves the batter-runner OUT before first;
2. first-base control is backed by secured possession plus physical base contact;
3. no other offensive runner exists;
4. equal-tick runner/base contact has not produced the existing simultaneous/unresolved result; and
5. no already-scheduled supported physical event at an earlier or equal canonical tick can invalidate the terminal state.

For this case, all offensive runners are retired while the defense securely controls the ball, so the play can end at the authoritative out/control boundary.

A SAFE-at-first result is explicitly non-terminal in milestone 1. `BatterRunnerWorldTimeline.endTick` is a simulation horizon supplied by the caller and must never be interpreted as evidence that live action ended.

The general future live-ball play-end policy must handle safe runners stopping/advancing, additional runners, relays, tags, dead balls, and voluntary stopping. That is explicitly deferred.

## 8. Final-base derivation rule for the first slice

Final occupancy is published only for a terminal supported play:

- terminal first-base OUT with no pre-pitch runners -> bases empty;
- SAFE -> no completed final occupancy yet in milestone 1;
- unresolved/simultaneous -> no final occupancy is published.

The resolver must not accept `basesAfter` as input for this production entry point.

Existing lower-level adapters that accept `basesAfter` may remain for compatibility/tests, but they are not the authoritative new production entry point.

## 9. Official-result boundary

The first completed slice uses the narrow descriptive classification:

- `batter_runner_out_before_first`

A SAFE race result may be exposed only as non-terminal evidence until continuation is modeled.

Do not label a safe result as an official single. A safe-at-first result can later depend on error/fielder's-choice/other scoring evidence.

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

## 11. Continuous capability frontier

There is one production live-ball architecture, not a sequence of separate Phase 1 / Phase 2 result engines.

The first milestone established the authority boundary. From here, implementation may add whichever missing physical/action/rule capability is dependency-ready while preserving the same direction:

- SAFE continuation and post-base movement;
- runner stopping, retreating, route replacement and arbitrary world-space targeting;
- pre-pitch runners and independent multi-runner world state;
- force transitions, tags, rundowns, relays and possession loss;
- general rule/action-based PlayEnd;
- post-PlayEnd adjudication / OfficialPlayClosure;
- causal final official occupancy derivation;
- production-result statistics observation;
- downstream hit/error/fielder's-choice and other official scoring.

No capability may use a generic "advance N bases because result=double" rule.

`RunnerRoute`, `currentBase/nextBase`, and result labels may be useful planning or descriptive abstractions, but canonical runner position/touch history remains authoritative. If a physical or debug discontinuity moves a runner off the planned route, future motion must rebase from the new canonical world state.

Statistics remain observers. They cannot feed back into Core resolution.

Official scoring remains a downstream description of completed physical/rule evidence.

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

## 15. Adversarial design audit A — 2026-09-19

The first hostile review found three high-severity architecture risks and two important boundary risks.

### A-1 — HIGH — missing causal ground-ball possession bridge

**Attack:** the first draft said "supported pickup state" without proving where it comes from. That wording could permit a caller to inject possession and skip the hardest fielding transition.

**Resolution:** the design now requires the production coordinator to derive rolling/live batted-ball glove contact and catch retention from existing physical primitives. No public pickup tick or possession boolean is accepted.

### A-2 — HIGH — SAFE was incorrectly close to a play-end shortcut

**Attack:** a runner reaching first safely does not imply the live ball is over. The runner may continue and the defense may continue.

**Resolution:** milestone 1 is narrowed to the terminal no-pre-pitch-runner force-out-at-first path. SAFE remains non-terminal evidence and cannot produce final occupancy or `PlayEndFact` yet.

### A-3 — HIGH — raw throw release tick could remain hidden caller authority

**Attack:** `CoverageThrowExecution` accepts `releaseTick`; if the top-level production path forwards an injected value, the simulation still skips causal transfer/release timing.

**Resolution:** the top-level production coordinator may accept calibration/rating inputs but not a raw release tick. Secure possession feeds rated ball-transfer timing. Until a full arm/hand constraint model exists, `throwReadyTick` is used as an explicitly documented zero-duration ready-to-release launch approximation.

### A-4 — MEDIUM — simulation horizon is not play-end evidence

`BatterRunnerWorldTimeline.endTick` is a caller-selected horizon. It cannot create or justify a `PlayEndFact`.

This prohibition is now explicit.

### A-5 — MEDIUM — decision probability leakage

`ThrowPlan` probabilities remain valid only for selecting an action. The implementation audit must reject any code path that copies them into out/run/base/result facts.

### Gate A result

After the revisions above, no known high-severity design finding remains unresolved.

The remaining model approximation is the zero-duration ready-to-release launch boundary. It is explicit, deterministic, downstream of secure possession/transfer timing, and must be replaceable by a future hand/arm constraint model without changing RuleEngine semantics.

## 16. Adversarial implementation audit B — 2026-09-19

Gate B was run against the first production no-runner ground-ball force-out vertical slice. The review intentionally attacked evidence identity, causal timing, caller authority, decision-probability leakage, nonterminal SAFE handling, failed possession, clock consistency, final occupancy invariants, determinism, and Presentation/P9 isolation.

### B-1 — HIGH — swappable BallFlight evidence

**Attack:** the first implementation accepted a `BattedBallFlightEvidence` object without proving that its contact and initial ball state belonged to the current `CanonicalPlateAppearanceTimeline`. A caller could therefore replay physical evidence from a different contact against the current play.

**Resolution:** `GroundBallFlightEvidenceBinding` now binds the carried flight evidence to the authoritative timeline `BatBallContact`, verifies the initial ball state, and verifies that any reported first-ground-contact tick/state is reproducible from canonical ball physics.

**Fix commit:** `e5e4d67d389a7fdf917ddb3523125e60a69bb5f0`.

### B-2 — HIGH — cross-play batter-runner evidence substitution

**Attack:** a physically valid `BatterRunnerWorldTimeline` from another play could be supplied to the coordinator and change the first-base race.

**Resolution:** `GroundBallRunnerEvidenceBinding` requires the runner timeline and recovery origin to start at the current authoritative bat-ball contact tick and preserves the canonical recovery-to-launch boundary.

**Fix commit:** `cc14c147fd29839c50c39a9d978b16a01739e61e`.

### B-3 — HIGH — future defensive evidence could influence past action

**Attack:** `TeamCoveragePlan` already records `evidenceAvailableAt`, but the initial coordinator did not reject a ball-handler or first-base-cover assignment whose evidence arrived after the physical pickup or throw-ready boundary. This allowed a future observation to justify an earlier action.

**Resolution:** `GroundBallCoverageEvidenceTiming` requires ball-handler evidence no later than physical pickup contact and selected first-base-cover evidence no later than the derived throw-ready tick.

**Fix commit:** `e581fbc5f54c277bdf36b5d5e9fa2f79bd7ddb57`.

### B-4 — authority-regression guards

The production input is protected by compile-time hostile checks. Reintroducing caller-supplied `releaseTick`, `pickupTick`, possession boolean, `basesAfter`, `PlayEndFact`, or official outcome fields causes type verification to fail.

**Guard commit:** `d19cf2ed0c9323cec7f41ed9bcd02ece3304b9c9`.

### B-5 — advisory probability / subsystem isolation

The production coordinator is guarded against directly consuming `outProbability`, `scoreProbability`, or `expectedExtraBasesAllowed` as authoritative truth. These values remain legal inside `ThrowPlan` for action selection only. Source guards also reject P9 batch/statistics and Presentation dependencies in the production coordinator.

The integration fixture additionally reruns the same physical play with the same RNG seed and requires exact result equality. With the same single selected throw action, changing only advisory `outProbability` also requires the exact same physical/rule result.

### B-6 — nonterminal and physical-failure hostile cases

The production vertical slice now explicitly verifies:

- a slower physical throw that resolves SAFE at first remains `live_ball_continues` and does not publish a completed final occupancy;
- failed ground-ball retention remains live and does not create transfer, throw, race, or result facts;
- mismatched subsystem clocks are rejected before comparing race events;
- existing first-base physical-race tests preserve exact simultaneous arrival as unresolved;
- missing reception and failed receiver retention do not invent defender control.

### B-7 — third-out scoring and occupancy contradictions

Existing `FirstBasePhysicalRace` integration proves that a two-out batter-runner-before-first out feeds the same physical facts into `RuleEngine` and suppresses an earlier home touch as required.

`PlateAppearanceMatchStateLiveBallAdversarial.test.ts` additionally rejects:

- the same runner occupying two final bases;
- a scored runner simultaneously remaining on a final base.

The new production coordinator does not accept final base occupancy from its caller at all; these lower-level guards remain for compatibility paths and future multi-runner expansion.

### Gate B verification

Latest code verification before this documentation update:

- exact head: `bd4e2d1fe9af801fdaddafc9ddc717462a8871d5`;
- GitHub Actions run: `35433533614`;
- test files: **236 passed / 236**;
- tests: **1086 passed / 1086**;
- frozen P9 fingerprints remained:
  - `0d6e8aefd4601e9a`;
  - `8c3db4d6447bcad5`;
  - `d49f585e4b33fb17`;
- P9 batch calibration fingerprint remained `f5058efd2d23784c`.

No known HIGH-severity Gate B finding remains unresolved.

### Remaining bounded risks / explicit deferrals

The following are not treated as completed capabilities:

- SAFE-at-first continuation is still intentionally nonterminal; advance/stop/throw continuation must be modeled before final occupancy or official hit classification.
- Pre-pitch runners remain outside this first production slice.
- `throwReadyTick` is still the documented zero-duration ready-to-release approximation until a physical hand/arm constraint model owns release.
- Throw flight still receives an explicit physical acceleration vector. It is not an outcome field and cannot directly declare OUT/SAFE, but a dedicated throw-flight model should eventually own gravity/aerodynamic calibration instead of exposing a raw per-play vector.
- Defender/runner physical primitives are accepted as upstream canonical physical evidence. As world orchestration expands, their provenance should continue to be bound to the same play/state rather than replaced by result shortcuts.

Gate B therefore permits expansion only from the verified causal boundary; it does not permit reintroducing statistical-result shortcuts.

## 17. Adversarial closure audit C — 2026-09-19

Gate C replayed the original authority map against the implemented production path and the exact verified source head.

### C-1 — implemented authority chain

The supported production slice now follows this one-way chain:

```text
authoritative BatBallContact
  -> bound BallFlight evidence
  -> rolling-ball / glove physical contact
  -> CatchRetention secure possession
  -> causally-timed TeamCoverage evidence
  -> rated transfer timing
  -> derived throw-ready / launch boundary
  -> physical throw launch
  -> receiver glove contact + retention
  -> receiver controlled-base contact
  -> batter-runner physical first-base touch
  -> existing FirstBasePhysicalRace / RuleEngine
  -> terminal no-runner OUT only
  -> internally-created PlayEndFact
  -> derived empty final occupancy
  -> CanonicalLiveBallFinalResult
  -> PlateAppearanceMatchState
  -> optional read-only validation observation
```

No Presentation, P9 bucket, validation statistic, advisory probability, caller-supplied OUT/SAFE, caller-supplied final bases, caller-supplied possession, or caller-supplied release tick is authoritative in this chain.

### C-2 — official classification remains downstream-only

`CanonicalLiveBallFinalResult.officialOutcome` is the single **bounded descriptive classification** authority for the first production slice.

Despite the legacy field name, it is not the future umpire/review `FinalOfficialRuling`. General adjudication uses the separate contract in `07-world-first-adjudication-contracts.md` and must not overload this field.

The first supported classification is intentionally only:

- `batter_runner_out_before_first`.

Nonterminal and unsupported cases remain explicit. The validation bridge may observe supported production truth, but production does not import the bridge, `BatchValidationStatistics`, P9 calibration buckets, or Presentation state.

### C-3 — exact regression evidence

Closure verification:

- exact head: `6d126b8e0e501b513f33ec586ec151e30657e241`;
- self-hosted GitHub Actions run: `35433883430`;
- TypeScript typecheck: passed;
- test files: **237 passed / 237**;
- tests: **1089 passed / 1089**;
- fixed-seed fingerprints:
  - fielding: `0d6e8aefd4601e9a`;
  - baserunning: `8c3db4d6447bcad5`;
  - rules: `d49f585e4b33fb17`;
- P9 contacts fingerprint: `2f545c9acac3ab71`;
- P9 normal evaluations fingerprint: `bf334bb3105106fc`;
- P9 pull-heavy evaluations fingerprint: `c9dfd271c5b04152`;
- P9 calibration fingerprint: `f5058efd2d23784c`.

No evidence-version migration was required.

### C-4 — residual medium / low risks and explicit deferrals

No known HIGH-severity issue remains for the bounded slice.

Remaining risks are intentionally not hidden:

- **MEDIUM — SAFE continuation:** SAFE at first is physical race evidence, not a completed play. Runner continuation, stopping, further throws, and final occupancy still require a causal continuation orchestrator.
- **MEDIUM — occupied-base / multi-runner orchestration:** pre-pitch runners remain unsupported by this production coordinator. Force transitions, tags, relays, run timing, and play-end policy must be added one bounded case at a time.
- **MEDIUM — throw release approximation:** `throwReadyTick` remains the documented zero-duration ready-to-release approximation until a hand/arm constraint model owns the actual release boundary.
- **MEDIUM — upstream primitive provenance:** defender/runner physical primitives are accepted as canonical upstream evidence. As orchestration broadens, their identity/provenance must continue to be bound to the same play rather than becoming caller-controlled result shortcuts.
- **LOW/MEDIUM — throw acceleration ownership:** the coordinator still accepts an explicit physical throw-acceleration vector. A dedicated throw-flight model should eventually own gravity/aerodynamic calibration.
- **MEDIUM — official scoring breadth:** hit/error/fielder's-choice and extra-base official classifications are not implemented here. They must remain `unsupported` until downstream scoring evidence is sufficient.
- **MEDIUM — calibration bridge breadth:** the new production statistics bridge is architecturally valid but the existing 1,024-contact P9 batch remains the older validation-only reach-bucket calibration. It must not be relabeled as production batting statistics until enough production live-ball outcomes are supported.

### Gate C result

The first post-roadmap causal live-ball production milestone is closed.

It proves the authority direction, not complete baseball coverage:

```text
physics / decisions / rules
        -> canonical production outcome
        -> validation / presentation observers
```

Never the reverse.

The next production expansion may add SAFE continuation, occupied-base/multi-runner behavior, route rebasing, or another dependency-ready item from the continuous capability frontier. None of these creates a separate architecture; all preserve the same verified one-way authority boundary.