# Human Control Overlay v1 — headless API

## Authority and implemented slice

Implements doc32 §18, doc38 §§7–8/13, doc42 §§18–19/22 and doc49 §§13–16/39–45 from design commit `782f6b8ef2406839de5678b00040001111cd8f77`, on source baseline PR #26 `062cf366db8a878c666b3d55bbc0e9e83c8e2d5f`.

This module owns **one human controller's active club/domain policy and decision-origin attribution**, not the Manager Agent. It is executable independently of a UI. It is not wired into existing simulation, roster commands, persistence, rendering or a client.

The current manager and appointment are supplied with each decision opportunity by the authoritative club/manager owner. No manager, contract, skill, belief, memory or relationship is duplicated in the overlay. A genuine future appointment change therefore works during human control; removing the overlay does not resurrect an old manager. Historical decisions keep the manager and appointment captured at selection time.

## Public operations

Import from `src/core/world/control/index.ts`.

| Function | Result | Responsibility |
|---|---|---|
| `createHumanControlState(input)` | immutable `HumanControlState` or `ControlValidationError` | Create/restore policy, validate its schema, IDs, domains and revision. |
| `changeHumanControl(state, change)` | state + change events, or original state + rejection | Atomically switch club/manual domains, delegate domains or remove the overlay. |
| `resolveDecisionAuthority(state, opportunity)` | human-required or current-manager route | Identify the decision owner; never run a manager or choose an action. |
| `selectControlledDecision(state, opportunity, submission)` | immutable `ControlledDecision` or rejection | Accept the exact action through shared legal-action membership and identity/context/revision checks. |
| `restoreControlledDecision(input)` | immutable record or `ControlValidationError` | Restore a trusted stored record, rejecting contradictory actor/origin/appointment facts. |
| `attributeExecutedDecision(decision, execution)` | world evidence + optional manager self-chosen evidence | Join actual event references to the captured decision without inventing execution or outcomes. |

Factories/restoration throw for malformed stored data. Operational calls return `{ ok: false, reason }` for malformed ordinary data and expected refusals. Unexpected programmer errors are not swallowed. Inputs are ordinary JSON-like records, not adversarial JavaScript proxies or accessors.

## Policy and routing

The host registers **existing baseball capability IDs**, not buttons, screens, mood interventions or a new action catalogue. `domainIds` is the recognized set; `manualDomainIds` is a subset. Both are detached, sorted, unique and immutable.

- Current club, manual domain: `HUMAN_REQUIRED`. A manager submission is refused rather than silently replacing the pending human choice.
- Current club, other registered domain: current manager, `MANAGER_DELEGATED`.
- Other clubs or no active overlay: current manager, `MANAGER_AUTONOMOUS`.
- An explicit human action may override a delegated domain for the controlled club without changing its persistent policy.

Policy changes use `expectedRevision`; real changes increment it once. No-op changes emit no event and preserve the revision. Invalid/stale changes return the original state and no success events. Revisions are nonnegative safe integers; overflow is refused. Switch-away/switch-back does not revive old proposals.

This is a single-controller boundary. Multiplayer arbitration, domain-registry migration and changing a controller identity are not implemented. No history grows inside policy state.

## Selection example

These illustrative action IDs refer to already-created immutable host action descriptions; they are not a command catalogue or a UI prescription.

```ts
import { createHumanControlState, selectControlledDecision } from '../../src/core/world/control';

const state = createHumanControlState({
  revision: 0, controllerId: 'human-1', controlledClubId: 'club-A',
  domainIds: ['IN_GAME_COMMAND', 'BULLPEN'], manualDomainIds: ['IN_GAME_COMMAND'],
});
const opportunity = {
  decisionId: 'decision-17', contextId: 'context-17', worldRevision: 120,
  clubId: 'club-A', domainId: 'IN_GAME_COMMAND',
  managerId: 'manager-A', appointmentId: 'tenure-A-2',
  legalActionIds: ['action-bunt-17', 'action-swing-17'],
};
const selected = selectControlledDecision(state, opportunity, {
  decisionId: 'decision-17', contextId: 'context-17',
  expectedControlRevision: 0, expectedWorldRevision: 120,
  actionId: 'action-bunt-17', actor: { kind: 'HUMAN', controllerId: 'human-1' },
});
// selected.ok -> selected.value.origin === 'HUMAN_OVERRIDE'
// This selected record is NOT proof that the bunt was attempted or succeeded.
```

A manager submission uses `actor: { kind: 'MANAGER', managerId, appointmentId, traceId }`. The trace reference points to the actual decision-time trace. The manager ID AND appointment ID must match the opportunity; rehiring the same person does not validate an old-tenure proposal.

Both human and manager pass exactly the same `legalActionIds` membership check. This module does not generate legal actions or perform the underlying RuleEngine/roster/physical feasibility checks. The authoritative action owner must supply the current set. Human input is never changed by manager skill or a fallback selector.

A submission is bound to **decisionId + contextId + expected world revision + expected overlay revision**. IDs and revisions are required even when actors and action choices happen to coincide across decisions.

## Actual consequences versus self-chosen evidence

`attributeExecutedDecision` requires a real execution receipt with matching decision/context/action IDs, a non-predating world revision and nonempty unique canonical event IDs. Selection alone cannot generate this receipt.

Every origin gets `worldEvidence`. Existing world events, player statistics, relationships, role history and titles remain canonical; the projection neither creates nor reapplies these consequences.

Only `MANAGER_AUTONOMOUS` and `MANAGER_DELEGATED` get `managerSelfChosenEvidence`, including the historical manager, appointment and decision-time trace. Use this channel for **both** self-chosen strategy learning and decision-quality/skill/hiring evidence. `HUMAN_OVERRIDE` returns `null` in this channel even when its outcome was excellent or terrible. Human outcomes may still be observed through legitimate world evidence; absence of self-chosen evidence does not erase them.

Calling the projection again is deterministic and does not grow hidden state. **It is not a persisted exactly-once executor.** Consumers must deduplicate `executionId` transactionally before applying learning/evaluation updates. No decision score, self-learning algorithm, relationship change or mood modifier is implemented here.

## Required host responsibilities / trust boundary

1. Authenticate the controller/manager producer before building the actor. Structural checks here are **not security authentication**. Never accept a client-supplied opportunity, legal-action set, current appointment or execution receipt as authoritative.
2. Pin decision/context/action/trace/event references to immutable, versioned records. An action ID must not later resolve to different parameters. A trace ID must resolve to the actual decision-time evidence, not an explanation invented after seeing the result.
3. Compare-and-swap the current world/control revisions and opportunity status when committing a selection. This pure module cannot detect concurrent writes occurring after its call, repeated submissions, or a host that supplied an obsolete opportunity. A decision must be selected once by its owner.
4. Persist accepted decision records, pending execution and actual event receipts with the host's transaction/replay protocol. Execute through the existing action/Match Core owner and revalidate if required by that owner's timing contract. No selected choice is an OUT/SAFE, score, completed roster change or proof of physical execution.
5. Store canonical events and deduplicate evidence application; do not apply `worldEvidence` as new world events a second time. On restore, load historical decisions rather than recomputing origin from today's overlay or manager.
6. Keep private manager traces behind the existing knowledge/visibility boundary. These are internal records, not an opponent thought-log exposure API. Bound trace retention and input sizes at their storage/service owners.

## Refusal codes

`INVALID_INPUT`, `UNKNOWN_DOMAIN`, `STALE_CONTROL_REVISION`, `STALE_WORLD_REVISION`, `DECISION_CONTEXT_MISMATCH`, `REVISION_EXHAUSTED`, `HUMAN_NOT_AUTHORIZED`, `HUMAN_INPUT_REQUIRED`, `STALE_MANAGER_APPOINTMENT`, `ILLEGAL_ACTION`, `EXECUTION_MISMATCH`, `EXECUTION_PREDATES_DECISION`.

A consumer may translate these codes later; the module contains no display copy, layout or navigation decisions.

## Explicit non-goals

No UI/Work/rendering connection; no social-action buttons; no Manager Agent replacement; no manager market/retirement simulator; no manager selector/forecast/search engine; no full decision-trace retention service; no strategy/skill update algorithm; no physics, special-ability or mood buffs; no persistence database, network endpoint, concurrency service or full live game integration. These remain separate approved slices and must not be reported complete by this module.
