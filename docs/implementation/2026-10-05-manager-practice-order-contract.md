# Manager practice order from an authenticated belief boundary

This is the next bounded connection in the
[Manager practice selection plan](2026-10-05-manager-practice-selection-connection.md).
The historical belief boundary was verified separately before this adapter's
production changes. This document specifies the bounded adapter and its accepted
input contract.

## Inputs and producer

Use the existing practice owner, prescription authority, legal-action binding,
World CAS and actual attempt owner. Add `ManagerPracticeOrderFromBelief.ts` as a
facade over Manager methods installed in that same owner. It does not accept a
caller-built Manager agent, chosen action, reason trace or completion receipt.

The request preserves the existing practice decision fields, including optional
`prospectiveExecutionId`, and adds an explicit Manager selection request:

```ts
type ManagerPracticeSelectionRequest = Readonly<{
  version: 'manager-practice-selection-v1';
  managerId: string;
  appointmentId: string;
  expectedBeliefRevision: number;
  traceId: string;
}>;
```

The stable trace ID names the generated trace; it is not accepted evidence that
selection occurred. Resolve the existing Manager Person at the exact quoted
revision using `readManagerBeliefBoundary`. Require the active Club appointment,
registered `PITCH_PRACTICE` domain, original prescription and exact current
World/control/Club/roster/body inputs. The Manager agent must already contain a
belief for the exact accepted practice action ID. Never borrow a ROSTER belief,
create a default estimate or fabricate a roster bootstrap.

The existing accepted prescription does not identify a decision action; its Human
request supplies `actionId`. For Manager selection, extend that same accepted
prescription authority with an optional explicit binding:

```ts
managerAction?: Readonly<{
  version: 'manager-practice-action-v1';
  domainId: 'PITCH_PRACTICE';
  actionId: string;
}>;
```

This field is accepted source data, not a caller-authored alias. Its enclosing
prescription binds the action to the complete prescribed command. A Manager
request requires it and must quote its exact `actionId`; only that ID enters the
legal set and belief lookup. Naming an existing ROSTER action such as `promote`
cannot override a prescription bound to a different practice action. No action
namespace or global action registry is invented. The authority owns the semantic
mapping, while the consumer verifies its exact accepted identity. Preserve the
complete binding in the immutable prescription; omit this decision metadata when
assembling the physical `PitchPracticeOpportunity`. Existing Human prescriptions
without the optional field retain their original bytes and behavior.

The first route has the same single prescribed legal command as the Human owner.
Call `selectManagerControlledDecision` with that real opportunity and the
authenticated agent. A singleton legal set is supported; it is not autonomous
candidate generation. Body inputs validate the command, but hidden Player ability
or future physical results never become Manager scoring inputs.

Missing accepted prescription, Manager action binding or Manager Person remains
explicitly unavailable with zero intake rows. A supplied malformed binding,
mismatched action, stale input or unrepresented action fails validation without
reserving the Source. A manual domain requires Human input before trying to derive
a Manager choice. No domain registration, permission change, alternative rest
action, schedule or practice dose is inferred.

## Immutable proposal and actual issuance

The Manager version of the prepared decision freezes its full belief boundary and
the actual generated `ManagerControlledSelection`, together with the existing
legal command and original physical/control evidence. Preserve historical Human
receipt bytes; the new route must be explicitly identifiable in its request and
record. Reuse the existing decision/order tables rather than creating another
Manager or practice database.

The planned facade methods are:

- `prepareManagerOrderDecision(input)` returns the immutable Manager proposal or
  a named missing-input/Human-required result, with no order or body effect
- `readManagerOrderDecision(sourceId)` reauthenticates its exact original boundary
  and regenerates the same selection from the frozen inputs
- `issueManagerOrder({ decisionSourceId, executionId })` consumes that proposal;
  it derives the Manager submission itself rather than accepting a caller trace

Before first Manager issuance, require the quoted belief boundary to remain
current, reselect and compare the complete trace, and retain the existing current
World/control/Club/roster/body preconditions. Check the original source and shared
reservations before and after the writer's INSERT/CAS. Exact retries use the
historical boundary. A later Manager observation never silently rebases an old
proposal.

Manager authority is delegated or autonomous according to the existing generic
control gate and current appointment. The existing Human preparation path keeps
its `controlledClubId === clubId` requirement. The explicit Manager version uses
`resolveDecisionAuthority` instead: the controlled Club's manual domain requires
a Human; its delegated domain permits the appointed Manager; another Club permits
its appointed autonomous Manager. Registration and appointment checks remain
required in every branch. Actual `PracticeOpportunityIssued` remains the executed
effect. Its projection may contain Manager self-chosen evidence for that issuance;
selection alone has no executed attribution. No Manager belief update, Player
capability gain or successful repetition is generated here.

## Human override remains a separate actual choice

A prepared Manager proposal must not use its canonical reservation to block the
existing explicit Human override on a delegated domain. A real Human submission
consumes that same still-unissued legal opportunity by calling existing
`issueOrder` with the original Manager proposal's `decisionSourceId`, the real
Human submission and execution ID. It must not prepare a second Human decision
against the same reserved prescription or attempt. The version-aware original
decision read authenticates the Manager proposal historically, then existing
`selectControlledDecision` selects the actual Human submission. The Manager
proposal remains immutable, while the actual order records the Human decision
and `managerSelfChosenEvidence: null`.

Only Manager execution demands current Manager-belief revision. Human override
still authenticates the proposal's original historical evidence and all current
control/World/Club/body preconditions; a later legitimate Manager observation
alone cannot turn the Human choice into a stale Manager execution. Neither route
can overwrite an already issued order, and Manager execution cannot borrow a
Human-only prepared decision as its missing selection proof.

## Test-first scope

Use genuine file-backed existing Club/control/roster/Person/body/practice owners.
An explicit test seed may include a synthetic practice-action belief before the
fixture's real roster promotion; the promotion is already the episode's genuine
cause. Production must only read an existing Manager Person and must not create
that seed or any numerical belief. Missing-input fixtures must demonstrate zero
new decision/order/World rows and successful later explicit enrollment.

The next contracts will cover exact generated/reselected trace; delegated and
autonomous authority; preserved Human controlled-Club restriction; manual-domain
refusal; wrong appointment; missing action binding or belief; a request that
substitutes a ROSTER action for the accepted practice ID; stale first Manager
issuance; Human override of the same decision Source before and after a later
Manager observation; no borrowing of Human/ROSTER traces; witnessed source
mutation rollback; historical retry/reopen; and actual delivery followed by one
independently assessed PRACTICE and eligible episode event. A belief-only advance
in the override fixture observes an already executed genuine roster action; it
must not perform a new roster execution that would correctly stale the World and
roster preconditions. Verify that Manager history is unchanged by issuance and by
this adapter's completion path.

The exact existing seams are `AcceptedPracticePrescription`, `command`,
`opportunity` and the prescription/attempt uniqueness constraints in
`src/host/world/OwnedPitchPracticeOrder.ts`; `resolveDecisionAuthority` in
`src/core/world/control/HumanControl.ts`; and action-ID matching in the existing
Core `ManagerDecision` selector. The fixture's explicit practice belief must be
present before its real promotion and Manager-history initialization. It is never
appended by mutating an already accepted Manager seed.

Keep the historical reader's 21 cases and existing affected owner tests as
separate source-qualified evidence. The review-domain consumer remains later work
and retains `manager_review_selection_unavailable` until its own actual selection
binding is implemented and verified.

## Implementation and verification boundary

The existing practice transaction now exposes the three Manager methods through
`ManagerPracticeOrderFromBelief.ts`. It uses the existing decision/order tables,
freezes the complete generated selection and historical belief boundary, and
checks original evidence on the writer connection before and after INSERT/CAS.
Human requests without the new fields retain their serialized receipt shape and
hash inputs. Actual attempt reads continue to authenticate their durable order
and World event; prospective probe frame evidence is unchanged.

The historical reader's separate source `b4e5ee8` passed its 43 selected cases and
full compiler. On adapter test source `c44181e`, all 25 contracts reached the exact
missing-facade error after genuine fixture setup. This establishes capability
absence, not 25 independently demonstrated behavior failures. The implementation
candidate still requires its own positive, affected-owner and compiler results.
Prescriptions, action beliefs, windows, effort/health assessments and any later
standardized learning inputs remain explicit accepted data. This slice generates
an actual Manager choice and order, not autonomous practice scheduling or gains.
