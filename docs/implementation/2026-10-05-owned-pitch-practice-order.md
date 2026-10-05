# Owned single pitching-practice order

Status: bounded Human implementation verified on integration `a6a0b418`:
catalog check, full compiler and 200 selected cases passed. See the
[source-qualified verification record](../verification/2026-10-05-owned-practice-order-integration.md).
Base: `a205481240c1233a3fa2cb300d8cc62156213473` (verified practice-learning
publication). Existing producers and numerical models remain the consumers.

## Goal and authority

Give one explicitly selected pitching-practice command a durable World origin.
The issued order supplies the existing `PitchPracticeOpportunity`; body motion,
effort assessment, workload and optional episode attribution still occur through
the existing actual practice owner. The approved nonvisual continuation requires
actual practice opportunity/execution. Frozen Foundation doc53 §§2,5,9,22,23,28
requires real opportunity/repetition and leaves numerical calibration explicit.
Draft32 supplies no authority. No UI, new schedule engine or automatic dose.

## Exact control route

The first slice supports an explicit Human submission only. The issuer uses the
existing `selectControlledDecision` gate, with the durable control snapshot and
a previously issued immutable legal-action binding. It never accepts a caller's
claimed origin or a fabricated Manager trace.

The capability ID is `PITCH_PRACTICE`, a distinct host-registered domain. It must
already exist in `HumanControlState.domainIds`; issuance neither registers a
domain nor changes control permissions. A Human actor must name the durable
controller and control this Club. An explicit Human override remains legal when
the domain is delegated, because `selectControlledDecision` already permits it.
The resulting origin is `HUMAN_OVERRIDE`; `attributeExecutedDecision` must return
`managerSelfChosenEvidence: null`.

Manager-origin submissions are unsupported in this slice and reject before any
order/World write. A future route must consume the actual durable Manager Person
belief and `ManagerControlledSelection`/trace, reselect the immutable candidates
through the existing selector, and authenticate the current appointment. This
slice does not invent those inputs.

Existing sources:
- `ControlTypes.ts:27–95`: legal opportunity, controlled selection and actual
  execution are separate contracts
- `ControlledDecision.ts:35–61`: current control/world, legal action, actor and
  origin checks; Human override does not require manual-domain mode
- `DecisionEvidence.ts:10–33`: attribution from actual canonical event IDs; a
  Human choice creates no Manager self-chosen learning evidence
- `SqliteWorldControlStore.ts:8–20,43–57`: existing World decision revision and
  event ledger, separate from season and Club revisions
- `SqliteManagerRosterDecisionStore.ts:417–594,671–776`: immutable candidate
  issuance and transactional World CAS conventions; its ROSTER domain is not
  repurposed for practice

## Explicit prescription and window

A versioned accepted prescription specifies one Player, Club, assignment unit
and required availability evidence; a day and bounded local microsecond window;
mode/cadence, nominal velocity/spin, mound reference, practice seed, Person link
and fatigue-policy IDs; canonical opportunity/ordinal/predecessor; and an optional
eligible technical episode reference. It supplies no completion or workload fact.
There is no inferred training recipe, effort, health number, calibration, recovery
or learning gain. Club trainingQuality, promotion and an open episode alone
cannot create a prescription.

The request quotes expected World, control, Club, roster, workload, timing and
release revisions. The owner reads and validates their real heads and generates
the final opportunity using those exact source revisions. Ready time must be
inside the explicit prescription window, and the planned follow-through must
fit before its end. Pure prospective delivery validation consumes no physical
phase or repetition. Preserve compatibility with the existing Player local clock. No day-to-microsecond or global elapsed-time conversion is made.

The participation requirement is part of the accepted prescription. It binds the
actual assignment and availability evidence; game competition eligibility is not
silently reused as a practice/clinical permission. This is an ordinary explicitly
permitted prescription, not an inferred medical clearance or rehabilitation dose.

## API and durable ownership

`OwnedPitchPracticeOrder.ts` supplies a facade over methods installed in
`SqlitePitchPracticeAttemptStore`'s existing connection. An optional `orders`
source group provides the existing World settlement, World control and roster
readers. The existing authority gains `readAcceptedPracticePrescription`; old
practice-only constructors retain their behavior. There is no second practice
database or extra body owner.

Methods:

- `prepareOrderDecision(input)` returns a named pending result when the accepted
  prescription is absent, otherwise one immutable issued decision opportunity
- `readOrderDecision(sourceId)` reauthenticates that original issued boundary
- `issueOrder({ decisionSourceId, executionId, submission })` validates the
  explicit Human submission and creates exactly one durable practice order
- `readOrder(sourceId)` returns its original opportunity/execution/projection
- Existing `begin(orderSourceId)` resolves the owned order directly; no external
  accepted-opportunity map is needed for the production route

`prepareOrderDecision` does not advance World time/revision or run body phases.
Missing accepted input returns pending with zero new decision/order/attempt/World
rows; malformed or stale supplied input rejects with the same zero-write rule.
A fully validated decision is frozen only once it is ready.

`issueOrder` atomically records a `PracticeOpportunityIssued` fact, its exact
`PitchPracticeOpportunity`, the existing World decision event and a +1 World CAS.
The executed effect is issuance of this order. It is never described as completed
body motion. The canonical order Source is derived from Career/execution identity,
and one issued decision can produce only one order; Source aliases cannot create
another repetition.

No attempt, consumed phase, PRACTICE activity or episode event exists until the
existing producer actually begins/advances/assesses/settles the issued command.
A pending assessment or stale later workload precondition does not rewrite the
order, replay motion or manufacture a receipt.

## Historical proof and first-write boundaries

Freeze original control, Club, roster, prescription, body-source revisions and
optional episode boundary. First issuance rechecks current World/control/Club/
roster/source revisions. Stale input fails closed without rebasing. Exact retries
reuse the same historical event/payload even after later legitimate World or
Player changes.

Reader authentication uses the frozen earlier source boundary and actual durable
World event, not today's heads as old inputs. Keep physical authentication free
of recursive current episode/World histories. The existing phase, workload and
learning guards remain intact. Changed original inputs on the consumer connection
must reject before commit and roll back all order/World changes.

## Bounded files and verification

Before production:
1. Save this design and genuine fixture/test contracts
2. Review the exact supported control route, no-effects boundary and failure paths
3. Observe the intended absent-producer RED on the frozen test candidate

Production after observed RED:
- Add `src/host/world/OwnedPitchPracticeOrder.ts` for prescription/decision/order
  validation, historical evidence and same-owner intake methods
- Extend `SqlitePitchPracticeAttemptStore.ts` with the optional sources/authority,
  direct owned-order resolution and frozen original-order evidence
- Preserve `SqliteWorldControlStore`, roster/Club numerical behavior and existing
  practice/workload/learning algorithms

The frozen initial selection contains 32 cases. Tests: new `OwnedPitchPracticeOrder.test.ts` and `.test-support.ts`, reusing
`PitchPracticeAttempt.test-support.ts` with test-only control-domain/source hooks.
The fixture must create genuine Club/control/roster/Person/body sources before
the absent-module import and register cleanup before opening SQLite handles.

Regression contracts:
- Pending missing prescription writes zero rows; later correct input succeeds
- Valid prepare/issue creates one canonical order and one World decision event,
  with no body, workload or learning effect
- Real Human evidence is consumed; delegated-domain override remains valid; wrong
  Human actor, foreign Club, missing domain and Manager actor reject
- Every quoted current revision and the full prescription/window are validated;
  changed source content and identity aliases cannot overwrite frozen intake
- `begin(orderSourceId)` works without a caller opportunity bundle; actual phase
  consumption then charges exactly one accepted PRACTICE and eligible episode
- Selection/issuance alone never marks an attempt complete; missing assessment
  stays pending without duplicated work
- Retry/reopen and a legitimate later order use historical original proofs
- Stale first write, changed authority and transaction-local source mutation
  leave original rows and World/Player state unchanged

The final gate must identify the exact source and selected test counts, preserve
RED evidence, and include the relevant control/World/practice consumers and full
compiler. Test fixtures use explicit synthetic prescriptions, not production
scheduling or empirical effort/calibration models.

## Matching measurement probes and order reservations

The existing pair contract freezes complete `PitchPracticeOpportunity` commands
and checks exact equality at probe admission (`ActualPitchTimingLearningFromPractice`,
`acceptedPlan` and `assertProbeAdmission`). The probes remain ordinary actual
attempts with `episode: null`. An issued World order may also supply that exact
command; the two provenance relationships must not create two physical owners.

Both intake paths must reject contradictory canonical-attempt or physical Source
claims before changing the first accepted reservation. A matching already-issued
order can join a later pair plan only when the complete opportunity is equal.
A prepared decision whose final physical Source is unknown cannot claim to match
an independently reserved probe merely because its canonical attempt ID matches.

Preparation may include an optional `prospectiveExecutionId` to reserve a future
physical Source for an ordinary decision before any probe exists. A decision
claiming an already reserved probe must supply this identifier. It is solely an
identifier, not an execution receipt, consumed phase or automatic selection. Derive the
future physical Source with the same Career/execution identity rule used by
`issueOrder`, and require exact Source identity and full opportunity equality
with the existing probe command. `issueOrder` must then use that exact execution
ID. Ordinary requests that omit the field retain their existing bytes/behavior.

The optional identifier must reserve its derived physical Source during
preparation against other prepared decisions, begun ordinary attempts, existing
orders and probe reservations. Contradictory claims reject immediately. The same
Source cannot be deferred to a conflicting later `issueOrder`. Canonical identity
checks remain separate and equally mandatory.

QUICK can quote a future workload revision in the original pair plan. Therefore
both orders cannot generally be issued before pair admission. The supported
causal path is: accepted prospective pair; matching NORMAL order; actual NORMAL
phase consumption and PRACTICE receipt; any separately accepted real recovery;
matching QUICK order at its now-current workload revision; actual QUICK execution.
Each actual begin still enforces the existing workload/timing/release currentness,
Player ownership, predecessor, local clock and same-day recovery-duration rules.
There is no synthetic revision advance, implicit rest or repeated execution.

Prospective body-frame evidence must remain separate from the actual attempt's
consumed order provenance. The former authenticates the original Player/body
sources even if a matching order is issued later. The latter must bind and
reauthenticate the actual durable order, decision and World event on every physical
read/adoption. Removing that distinction would either invalidate a lawful future
order or weaken the actual completion's authority proof.

Regression tests cover both conflicting admission directions, exact issued
order/probe sharing, and the full genuine pair → NORMAL order/consume → recovery →
QUICK order path. The complete reservation-sharing selection and compiler passed
on the exact integration source recorded above.

The prospective-frame rule is explicitly opted into with
`protocol.frameEvidenceVersion: 'BODY_FRAME_V1'`. Existing plans without that
field retain their historical capture and receipt bytes. A later order can join
an already accepted plan only when its declared evidence mode permits the later
order to be absent from the original frame proof. An exact order that already
existed when a legacy plan was accepted retains its original captured provenance.
Neither rule omits the durable order/event from an actual attempt's evidence.

## Review repairs and verification status

Decision and order writes compare their decoded durable result with the captured
pre-write input, including coherently rehashed substitutions. Ordinary
accepted Source IDs retain their unrestricted legacy prefix behavior. Actual
World issuance claims, including every occurrence of their original JSON identity,
identify orphaned orders even when copied SQL identity fields are corrupted or a
duplicate JSON key hides an unbegun order. An already completed
ordinary attempt keeps its Source when a later order would derive the same ID.

Shared reservations are checked before and after issuance on the writer's
connection. A decision freezes an already existing probe claim; it never adds a
later pair plan to its original evidence. A later plan must still retain a
compatible command throughout the issuance transaction.

The initial 32 absent-producer failures established the missing capability.
The original 32 cases plus four review regressions subsequently passed on
`cc3618cabff16ad24c76dd2995d4e6f7f2ca9030`. Separate RED checks reproduced the
ordinary Source collision, both orphan identity-mirror gaps and the later-plan
writer-side takeover. Four reservation conflicts reached their intended
assertions; five earlier extension cases stopped at protocol/optional-ID/prefix
entry boundaries, so their later sharing assertions were not demonstrated by
that RED result.

The current integration passed all 49 then-selected order cases before its
compiler identified four readonly assignments in the invalid-input test setup.
Those tests now construct replacement values immutably, preserving their checks.
A separate one-case RED reproduced an unbegun order takeover through a duplicate
JSON Source key before the ownership lookup adopted the existing all-key metadata
traversal. The earlier integration's adjacent groups did not run.

The final candidate retains 50 order cases, including the real NORMAL/recovery/
QUICK composition and writer-side rollback witness. Its complete gate selects
those 50, 122 existing practice/control/roster cases and 28 existing learning
cases, with full compilation. That complete 200-case gate passed on
`a6a0b4181f70c1a97594a5585702daf66826438d`, source tree
`8b544fb0854c4b7c3240515d93890c19c9abddae`. Prescriptions, Human selection, effort/health assessments and
standardization inputs remain explicit accepted inputs; this does not complete
an autonomous practice schedule or empirical calibration model.
