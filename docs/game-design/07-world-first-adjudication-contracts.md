# World-First Adjudication and State-Application Contracts

**Date:** 2026-09-20  
**Status:** IMPLEMENTATION-READY DESIGN CONTRACT  
**Governing documents:**  
- `docs/game-design/05-world-first-live-ball-architecture.md`  
- `docs/game-design/06-world-first-runtime-contracts.md`

This document defines how physical truth becomes an official game state without allowing umpire calls, review, official scoring, statistics, or Presentation to rewrite the physical past.

It is a runtime authority contract, not a product phase.

---

## 1. Five distinct meanings of "result"

The Core must preserve these boundaries:

```text
1. Physical Truth
        ↓
2. Correct Rule Interpretation
        ↓
3. On-Field / Review Adjudication
        ↓
4. Final Official Play State
        ↓
5. Official Scoring Classification
```

They may agree in ordinary plays.

They are still separate objects.

### 1.1 Physical Truth

Append-only evidence of what physically happened.

Examples:

- runner touched first at tick T;
- defender controlled first at tick U;
- tag contacted runner at tick V;
- runner missed second;
- ball was caught/retained/dropped;
- physical live action ended at tick W.

Physical truth is never rewritten by a call or scorer decision.

### 1.2 Correct Rule Interpretation

RuleEngine consumes physical/rule facts and answers what the rules imply if the facts are known.

Existing examples already follow this model:

- `GroundBallFirstBaseRuleEngineResult.correctRuleResult`;
- force/tag-out scoring;
- tag-up appeal results;
- third-out scoring;
- advantageous fourth-out selection.

Correct-rule output may remain `unresolved` when the evidence model has exact simultaneity or insufficient supported facts.

Do not invent a correct result merely to allow the match to continue.

### 1.3 On-field / review adjudication

Human umpire/review layers decide the **official call**, which may differ from Correct Rule Interpretation.

Conceptually:

```ts
type OnFieldCall = Readonly<{
  callId: string;
  tick: number;
  subject: AdjudicationSubject;
  ruling: UmpireRuling;
  evidenceBasisId: string;
}>;

type ReviewDecision =
  | { kind: 'confirmed'; callId: string }
  | { kind: 'overturned'; callId: string; replacement: UmpireRuling }
  | { kind: 'stands'; callId: string };
```

The exact types may differ.

The required property is provenance: every official ruling can point to the call/review/rule basis that produced it.

### 1.4 Final Official Play State

This is the official state used to start the next play:

- official outs;
- official surviving base occupants;
- official runs recognized;
- inning/half transition;
- any rule-authorized runner placement.

It is not the physical trace.

### 1.5 Official scoring classification

Official scoring describes the closed play:

- hit/error/fielder's choice;
- sacrifice;
- RBI/earned-run responsibility where supported;
- H/E line-score effects.

Official scoring does not decide physical movement, OUT/SAFE physics, or live PlayEnd.

---

## 2. Legal feedback versus forbidden feedback

The architecture is not "everything above rules can never affect later action".

Some information legitimately affects people.

### 2.1 Legal feedback

An `OnFieldCall`, coach signal, or review announcement may become a canonical information event.

Players/managers may perceive it and change later intents.

Example:

```text
Physical Truth: runner beat tag
OnFieldCall: OUT
        ↓
runner/defense hear OUT call
        ↓
their perception/decision changes
```

This is legal because the call changes **information and intent**, not the recorded physical past.

Likewise, a human manager challenge command from UI may enter the Core as a validated `ChallengeIntent`.

The rendered pixels themselves are never input.

### 2.2 Forbidden feedback

Illegal:

```text
scoreboard says OUT
  -> Core rewrites tag tick

official scorer calls error
  -> ball trajectory changes

desired team hit total
  -> runner is moved to first
```

---

## 3. Two closure boundaries

### 3.1 Physical PlayEnd

Existing `PlayEndFact` is interpreted as:

> the current physical live action is operationally complete.

It is produced by the ActionFrontier finalizer.

It may close continuous motion/throw/tag action.

It does not necessarily close:

- appeal opportunity;
- review/challenge;
- unresolved umpire call;
- advantageous fourth-out selection;
- official scoring.

### 3.2 OfficialPlayClosure

Add a later conceptual boundary.

```ts
type OfficialPlayClosure = Readonly<{
  playId: number;
  closedAtTick: number;
  playEnd: PlayEndFact | null;
  finalRuling: FinalOfficialRuling;
  officialDelta: OfficialMatchStateDelta;
  openWindows: readonly [];
}>;
```

A play becomes officially closed only when every rule/profile-supported official-state-changing window is closed/resolved.

The next pitch/play may use the new durable `CanonicalMatchState` only after this closure.

### 3.3 Non-live plate appearances

Strikeout, walk, hit-by-pitch, or other plate appearances that do not require a live-ball ActionFrontier may still produce `OfficialPlayClosure` directly from their rule/adjudication path.

A walk award may change the official base ledger without inventing a physical run between bases.

---

## 4. Adjudication lifecycle

This is one runtime state machine, not a staged product plan.

Conceptually:

```ts
type PlayAdjudicationState =
  | { kind: 'live_action_open'; playId: number }
  | {
      kind: 'physical_play_ended';
      playEnd: PlayEndFact;
      provisionalRuleState: CorrectRuleState;
    }
  | {
      kind: 'official_adjudication_open';
      playEnd: PlayEndFact | null;
      ruleState: CorrectRuleState;
      calls: readonly OnFieldCall[];
      openWindows: readonly OfficialStateWindow[];
    }
  | {
      kind: 'official_closed';
      closure: OfficialPlayClosure;
    };
```

Transitions must be monotonic.

### 4.1 Separate adjudication ledger

Do not reopen or append post-play adjudication into a physically completed `CanonicalPlateAppearanceTimeline`.

Use a separate append-only ledger/state keyed by the same `playId`, conceptually:

```ts
type PlayAdjudicationLedger = Readonly<{
  playId: number;
  lastRevision: number;
  events: readonly PlayAdjudicationEvent[];
  state: PlayAdjudicationState;
}>;
```

It may reference immutable physical timeline/event ids, but it cannot modify them.

This allows:

```text
CanonicalPlateAppearanceTimeline
  -> LiveBallPlayEnded
  -> physical timeline complete

PlayAdjudicationLedger(playId)
  -> appeal attempt
  -> umpire call
  -> challenge/review
  -> OfficialPlayClosure
```

Once `official_closed`, later scoring/statistical analysis may add descriptive records but may not alter that closure unless the RuleProfile explicitly models an extraordinary correction mechanism.

---

## 5. Appeal windows

Existing `AppealWindow` already shows why physical PlayEnd and official closure differ.

Its close reasons include:

- next pitch or play;
- defense left field.

Therefore:

```text
physical live action may end
        ↓
appeal window may remain open
        ↓
defense may make a valid appeal
        ↓
outs/runs may change
        ↓
official closure only after appeal possibilities resolve
```

### 5.1 Appeal action provenance

A sustained appeal result must come from:

- actual appeal attempt fact;
- valid appeal timing;
- relevant compliance/touch/departure history;
- RuleEngine interpretation.

Do not infer an appeal because the defense "would have" noticed a violation.

### 5.2 Advantageous fourth out

Existing `AdvantageousFourthOut` remains rule logic.

It belongs before `OfficialPlayClosure`.

An apparent third out may create a provisional inning-ending state, but the inning's official run result cannot be durably committed while a supported advantageous fourth-out option remains open.

### 5.3 Next-pitch fence

Attempting to begin the next pitch/play is itself a closure fence.

Before accepting it, the orchestrator must:

1. close appeal windows according to RuleProfile;
2. resolve any same-tick ambiguity at that closure boundary;
3. finish permitted review/challenge handling;
4. produce `OfficialPlayClosure`;
5. apply the resulting official MatchState;
6. only then increment/activate the next play.

No next-pitch command may silently destroy an unresolved official-state window.

---

## 6. Umpire and review boundary

### 6.1 Physical truth is retained

For every reviewed/called play, preserve enough linkage to compare:

```text
Physical Truth
Correct Rule Result
OnFieldCall
ReviewDecision
FinalOfficialRuling
```

### 6.2 Exact simultaneity

If the physical model produces an exact simultaneous/unresolved fact:

- Correct Rule Result may remain unresolved;
- an umpire may still issue an OnFieldCall;
- Final Official Ruling may follow the call/review rules;
- the Core must not rewrite the physical evidence into a fake before/after ordering.

This is one legitimate reason the official game can proceed even when "correct physical truth" is not ordered beyond the model's resolution.

### 6.3 Overturn placement

When review overturns a call, RuleProfile may need to place runners.

That is a **rule-authorized official reposition/award**, not a reconstruction of a physical trajectory that never happened.

Represent it as:

- official-state delta;
- optional between-play `rule_system` discontinuous world reset for the next-play setup.

Never insert fake historical base touches to justify the placement.

### 6.4 Same-tick information ordering

An umpire call or review announcement can influence only decisions whose information availability is at or after that canonical call/announcement event.

It cannot retroactively alter physical contacts already established at the same tick.

Where physical events are truly simultaneous, preserve simultaneity. Use deterministic event sequence only for information delivery/controller processing that is semantically orderable.

---

## 7. Correct-rule state may evolve before closure

Rule interpretation is event-driven.

A correct-rule snapshot can change when new legitimate facts arrive.

Example:

```text
apparent third out
  -> provisional run consequence
  -> timely appeal fact arrives
  -> sustained appeal out
  -> advantageous fourth-out evaluation
  -> revised correct-rule consequence
```

This is not mutation of old physical facts.

It is a newer rule interpretation over a larger append-only evidence set.

Conceptually every interpretation should carry:

- play id;
- evidence revision / last consumed event id;
- deterministic rule profile id.

This prevents stale rule snapshots from being applied after newer appeal/review evidence exists.

---

## 8. Official MatchState delta

Do not let arbitrary callers provide the durable delta for a production play.

Conceptually:

```ts
type OfficialMatchStateDelta = Readonly<{
  outsAfter: number;
  basesAfter: BaseOccupancy;
  scoredRunnerIds: readonly string[];
  halfInningTransition: HalfInningTransition | null;
  basisEvidenceRevision: number;
  basisRulingId: string;
}>;
```

It is derived from the final official adjudication state.

### 8.1 Existing compatibility type

Current:

```ts
ResolvedLiveBallPlateAppearance {
  playEnd;
  outsAfter;
  basesAfter;
  scoredRunnerIds;
}
```

remains a useful compatibility/application object.

But in the general production architecture it should be **created by the closure resolver**, not accepted as free caller authority.

### 8.2 MatchState application

Long-term application direction:

```text
OfficialPlayClosure
        ↓
derive/apply OfficialMatchStateDelta
        ↓
CanonicalMatchState for next play
```

`applyResolvedLiveBallPlateAppearanceToMatchState` can remain as the low-level pure applier if its production caller is constrained to a closure-derived resolution.

It should not become the place that decides appeals, umpire calls, occupancy entitlement, or official scoring.

### 8.3 Durable state stays old until closure

While adjudication is still open, the durable `CanonicalMatchState` remains the last officially closed state.

Provisional outs/runs/base placements belong to the play adjudication state, not to the durable next-play ledger.

Presentation may display a provisional call/review state explicitly, but the next pitch cannot consume it as settled MatchState.

---

## 9. Between-play world reset

After official closure, the physical world may not match the official next-play ledger.

Examples:

- incorrect on-field call retired a runner who physically touched safely;
- review places a runner at second;
- dead-ball award advances a runner;
- walk forces runners without modeling their full walking path.

The reset boundary is:

```text
OfficialPlayClosure
  + next-play BaseOccupancy
        ↓
BetweenPlayWorldReset
        ↓
next CanonicalWorldSnapshot setup
```

This reset has `rule_system` provenance.

It may be represented as discontinuous canonical setup because it occurs outside the closed live action.

Presentation may animate the reset, but animation does not create the official entitlement.

### 9.1 Reset completion gate

`OfficialPlayClosure` makes the official next-play ledger valid, but the next physical play must also start from a world snapshot consistent with that ledger.

Therefore next-play activation requires:

- official closure exists;
- between-play reset/setup has produced canonical runner/defender/ball starting state;
- every runner in `CanonicalMatchState.bases` has exactly one corresponding next-play world actor at the expected base/setup state;
- retired/scored runners are absent from active next-play runner actors;
- no stale previous-play controller remains active.

The reset animation may lag visually, but the next Core play cannot begin from a physically inconsistent setup.

---

## 10. Official scoring boundary

Official scoring consumes a closed/adjudicated play plus preserved physical evidence.

Conceptually:

```ts
type OfficialScoringInput = Readonly<{
  closure: OfficialPlayClosure;
  physicalEvidenceRef: string;
  ruleEvidenceRef: string;
}>;
```

Output may be:

```ts
type OfficialScoringResult =
  | { kind: 'supported'; record: OfficialScoringRecord }
  | { kind: 'unsupported'; reason: string };
```

### 10.1 It does not block next-play state by default

Runs/outs/bases must be official before the next play.

Hit/error/FC classification need not be the source of those facts.

Therefore unsupported H/E classification may remain explicit while the game proceeds if the official gameplay state is otherwise closed.

### 10.2 Line score

`CanonicalLineScoreSnapshot` already validates externally supplied H/E totals without deriving them from score.

That is compatible with this boundary.

Future production scoring can become the source of H/E updates, but until then the line-score model must not invent them.

---

## 11. Validation contracts

Validation must declare which truth layer it measures.

Conceptually:

```ts
type ValidationTruthSource =
  | 'physical_correct_rule'
  | 'official_game_state'
  | 'official_scoring';
```

Examples:

- physical model regression: use physical/correct-rule result;
- simulated box-score outcomes with umpire effects: use official game state;
- hit/error calibration: use official scoring.

Do not silently mix these populations in one statistic.

The current production statistics bridge may continue observing its supported canonical production outcome, but later expansion should name its truth source explicitly.

No validation statistic feeds back into physical resolution.

---

## 12. Presentation contracts

Presentation may show several layers simultaneously:

- physical replay/world animation;
- on-field umpire call;
- review status;
- official scoreboard state;
- official scoring label.

Rules:

- physical animation comes from canonical world/event truth;
- scoreboard bases/outs/runs come from official state;
- review overlay comes from adjudication state;
- H/E labels come from official scoring;
- Presentation never chooses which layer becomes authoritative.

If a call is overturned, Presentation updates the official display and may show a reset animation, but cannot rewrite the recorded physical replay.

---

## 13. Human/player command input

A user pressing "challenge" or issuing a manager command is legitimate input only after conversion into a validated Core action/intent.

```text
UI interaction
  -> validated domain command
  -> manager/runner/defender intent
  -> canonical action
```

Never:

```text
visible UI state
  -> Core result
```

This preserves Presentation isolation while allowing interactive management.

---

## 14. Current-code migration seam

Current code can evolve without a rewrite.

Keep:

- physical facts;
- RuleEngine correct-result functions;
- appeal-window/tag-up/fourth-out rules;
- PlayEndFact;
- PlateAppearanceMatchState pure application;
- CanonicalMatchState;
- CanonicalLineScoreSnapshot.

Add above/between them:

```text
ActionFrontierFinalizer
        ↓
PlayEndFact
        ↓
PlayAdjudicationState
        ↓
appeal / umpire / review adapters
        ↓
OfficialPlayClosure
        ↓
closure-derived ResolvedLiveBallPlateAppearance
        ↓
existing MatchState applier
        ↓
OfficialScoring observer
```

The current no-runner first-base production coordinator can initially use an identity adjudication adapter:

```text
Correct Rule Result == Final Official Ruling
```

only because umpire/review/appeal effects are outside that bounded slice.

The adapter must be explicit so this shortcut cannot become the permanent architecture.

---

## 15. Required invariants

1. Physical event history is append-only.
2. Correct Rule Result never depends on official scoring.
3. OnFieldCall may affect later perception/intent but cannot rewrite prior physics.
4. Review may replace official ruling but cannot fabricate physical event order.
5. OfficialPlayClosure cannot occur while an official-state-changing appeal/review window remains open.
6. Next-play MatchState cannot activate before OfficialPlayClosure.
7. Official scoring cannot move runners or decide physical OUT/SAFE.
8. MatchState appliers accept only closure-derived production resolutions in the general path.
9. Between-play rule-authorized reposition never fabricates historical base touches.
10. Validation/Presentation truth-layer choice is explicit.

---

## 16. Adversarial examples

### Wrong OUT call on physically safe runner

```text
Physical Truth: runner touch before tag/control
Correct Rule Result: SAFE
OnFieldCall: OUT
players react to OUT call
no review / call stands
Final Official Ruling: OUT
Official MatchState: runner retired
Physical replay: still shows runner physically safe
```

No contradiction exists because physical and official layers are separate.

### Review overturns OUT to SAFE with runner placement

```text
Physical Truth: SAFE
OnFieldCall: OUT
Review: overturned
Final Official Ruling: SAFE + RuleProfile placement
Official closure derives base occupancy
Between-play world reset places runner for next pitch
```

No fake historical running is added.

### Apparent third out followed by advantageous appeal

```text
Physical live action ends
apparent third-out consequence exists
appeal window remains open
defense makes timely appeal
RuleEngine sustains appeal
AdvantageousFourthOut changes run consequence
appeal window closes
OfficialPlayClosure commits inning result
```

The earlier PlayEnd did not prematurely freeze the score.

### Official scoring unsupported

```text
OfficialPlayClosure: runner safely on first, play state valid
OfficialScoring: unsupported hit/error/FC distinction
next play may begin
H/E classification remains explicit unsupported
```

No guessed single/error is required.

---

## 17. Adversarial deep-design closure audit — 2026-09-20

The combined world/runtime/adjudication design was attacked against ordinary and irregular play.

### D-1 — HIGH — stale route future can overwrite a rebased runner

**Attack:** a prebuilt `BatterRunnerWorldTimeline` or `RunnerMotionTrajectory` may still contain samples after a collision, teleport, or route change. If later sampled, it could snap the runner back to obsolete geometry.

**Resolution:** controller basis + `motionRevision` is mandatory. Rebase invalidates all old future samples at/after the rebase boundary. A stale controller must fail closed.

### D-2 — HIGH — discontinuity can fabricate crossed-base history

**Attack:** treating old/new positions as a continuous segment after teleport/reposition can create false second-base touches, tags, or collisions.

**Resolution:** every transition declares continuity. Discontinuous transitions have no swept path and create no intermediate contacts.

### D-3 — HIGH — physical PlayEnd can freeze official state too early

**Attack:** an apparent third out or quiescent live action can be followed by a timely appeal, advantageous fourth out, or review.

**Resolution:** `PlayEndFact` closes physical action only. `OfficialPlayClosure` is the durable official-state fence.

### D-4 — HIGH — next-pitch command can accidentally destroy an appeal/review window

**Attack:** incrementing `playId` or applying next-play MatchState before closing official-state windows makes later appeal/review impossible.

**Resolution:** next-pitch acceptance is a transactional fence: close windows -> resolve same-tick ambiguity -> produce OfficialPlayClosure -> apply MatchState -> prepare world reset -> activate next play.

### D-5 — HIGH — post-play adjudication can mutate a completed physical timeline

**Attack:** appending appeals/reviews to `CanonicalPlateAppearanceTimeline` after `LiveBallPlayEnded` would reopen or blur physical history.

**Resolution:** a separate append-only `PlayAdjudicationLedger(playId)` references immutable physical evidence.

### D-6 — HIGH — on-field call feedback can become retroactive physics authority

**Attack:** because players legitimately react to umpire calls, an implementation could incorrectly use the call itself to rewrite the earlier tag/touch order.

**Resolution:** calls are canonical information events. They may influence future perception/intent only after information availability; prior physical facts remain immutable.

### D-7 — MEDIUM — two runners at one base can be rejected too early

**Attack:** using `BaseOccupancy` as a live-world invariant would make legal/real transient states unrepresentable.

**Resolution:** live world permits conflicting physical proximity/touch. Entitlement is resolved before official ledger creation. If unsupported, closure remains unresolved rather than overwriting one runner.

### D-8 — MEDIUM — rule award can be confused with physical touch

**Attack:** walk/dead-ball/review placement might manufacture touch history merely to populate `BaseOccupancy`.

**Resolution:** physical touch and rule award are distinct acquisition facts. Between-play placement may follow an award without inventing historical running.

### D-9 — MEDIUM — provisional score can leak into durable MatchState

**Attack:** Presentation or an apparent third-out calculation can expose a run before appeal/review closes, and a careless path may write it to durable score.

**Resolution:** durable `CanonicalMatchState` stays at the last OfficialPlayClosure while adjudication is open. Provisional display state is separate.

### D-10 — MEDIUM — unsupported official scoring can block gameplay unnecessarily

**Attack:** lack of hit/error/fielder's-choice classification could prevent the next pitch despite outs/runs/bases being officially settled.

**Resolution:** OfficialPlayClosure is sufficient for next-play gameplay state. Official scoring is downstream and may remain explicit `unsupported`.

### D-11 — MEDIUM — between-play reset can start next play with inconsistent physical actors

**Attack:** OfficialPlayClosure may place a runner on second while the physical world still contains the old runner/controller elsewhere.

**Resolution:** next-play activation additionally requires a canonical between-play setup consistent with official BaseOccupancy and no stale previous-play controllers.

### Closure result

No known HIGH-severity design contradiction remains after these fixes.

Residual implementation risks remain intentionally visible:

- the runner actor/controller envelope now exists outside the compact `BaserunnerWorldState` snapshot shape; the snapshot type remains intentionally unchanged for compatibility;
- current route-distance motion cannot exactly represent arbitrary off-route velocity without a free-kinematic/transition controller;
- runner-runner collision/path negotiation is not yet implemented;
- general force/entitlement derivation for multi-runner final occupancy is not yet implemented;
- ActionFrontier and event-queue watermark are design-only;
- post-PlayEnd adjudication ledger / OfficialPlayClosure is design-only;
- umpire perception/review placement is design-only;
- broad official scoring remains unimplemented;
- current bounded `CanonicalLiveBallFinalResult.officialOutcome` naming remains compatibility debt and must not be reused as FinalOfficialRuling.

### Closed dependency-ready code capability — 2026-09-20

The capability previously named here has now been implemented and verified:

```text
Canonical runner kinematics
  + motionRevision
  + controller basis binding
  + route-following adapter over existing RunnerMotion
  + explicit rebase operation
```

Closure evidence:

- exact implementation head: `a3b1f4ce3aea1fd2fce1df60b5f5a6868fd604de`;
- self-hosted P0 Core run `35459687617`: success;
- **239 / 239** test files and **1102 / 1102** tests passed;
- no-rebase route behavior remains reproducible;
- all three frozen P9 fingerprints remain unchanged;
- rebase invalidates stale future controller authority;
- replacement control begins from the exact canonical state at the rebase tick;
- discontinuous rebase produces no swept intermediate base-touch fact;
- stale `motionRevision` / controller basis is rejected;
- production rebase provenance rejects Presentation/validation/scoring/desired-result authority;
- the existing no-runner ground-ball production path remains green.

This closes the implementation target that this design audit explicitly selected. The residual implementation risks listed above remain visible, but **none is promoted here into a new task or “next capability.”** Any further implementation requires a separately approved scope.