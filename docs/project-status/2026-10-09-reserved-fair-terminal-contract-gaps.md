# Reserved fair-play terminal connection: current contract boundary

This document and the accompanying Core catch delta were reconstructed after
the local executor reset on 2026-10-09. The original unpublished commit was
`9e82d3002c2a0c00436873db4b34420c6a0b34cc`. The recovered text preserves its
retained behavioral scope, but is not claimed to reproduce its exact bytes.

Missing Native stores or adapters are implementation work. Their absence does
not by itself establish a missing product choice or require user approval.
This audit separates that code work from inputs whose actual semantics or
calibration must come from an established source.

## Implemented standard-rule pieces

`ActualFairFieldTimeline` can project an already executed airborne catch when
`deriveBallWorldBattedRuleChronology` proves `fly_catch` and the independent
territory calculation proves fair. It preserves the original timeline and
records the original fielder touch, fair determination and independently
supplied physical end. It never manufactures a ground contact or treats a
catch tick as proof that all live action has ended.

`OfficialScoring` accepts an optional complete physical catch sidecar for a
closed live play. It re-derives and exactly matches that projection, checks
the same physical end, requires empty starting and ending bases, no scored
runners and exactly one added out, then classifies `fly_out` with zero H/E.
This supports initial out counts zero through two. A generic fair OUT cannot
establish whether an earlier hit or error occurred.

These are Core contracts. They do not create an accepted Native physical-end
Source, umpire action, communication receipt, scoring database owner or
terminal settlement. The Core tests supply their ledger and end explicitly;
they do not certify production provenance.

## A catch is a separate route from a first-base race

The reserved field path already exposes an actual secured airborne capture.
The first-base race adapter's need for both controlled-base contact and runner
touch is specific to that race. It is not a prerequisite for the existing
fly-catch rule. The catch route must keep its actual contact/capture evidence
and cannot obtain an official action by fabricating a first-base event pair.

`ActualFirstBaseUmpire` samples the first-base timing model from owned control
and runner-touch observations. Its `event_pair_unavailable` outcome is correct
when those facts are absent. Its numerical comparison is not a general
catch-perception policy. `ActualFoulOfficial` likewise starts from its own
sealed foul physical end and cannot stand in for a live fair-catch call.

## Existing machinery that can be connected by implementation

- Intake and authentication of existing runner recovery and motion parameter
  types, without selecting unsupported numerical values.
- Composition of real runner body trajectories with existing route and
  motion primitives once the owned intent, initial body state and parameters
  are present.
- Exact communication reception through existing accepted sender, receiver,
  availability and consumption contracts once an actual call exists.
- Producer/consumer census, due-work completion, original-reference checks,
  end sealing, official application and existing scoring writers.

The existing ActualLive end owner is more than a final physical snapshot.
`ActualFirstBasePlayEndEvidenceFromSqlite` binds the admitted causal runtime,
original physical references, closed quantizer generation, rule consumption,
umpire retirement, due observation/decision/motor consumers and communication
recipients. Reserved rows cannot merely be relabeled as those original
receipts. Neither a stationary ball nor a caller-selected horizon proves
producer completeness.

## Specific input and semantic gaps

### Batter home-to-first body and decision ownership

Field body sphere primitives provide actual position and velocity. Their
shape does not encode a body-forward orientation. `BattingCommitment` owns
`SwingKinematicsTrajectoryV1`, whose sweet-spot positions, velocities and bat
axes describe the bat. Equating its bat axis with the batter's body-forward
direction would add a relationship not established by that contract.

`BatterSwingExitRunTransitionParameters` already names the required
ticks-per-second, maximum body turn rate, lateral realignment acceleration
and backward recovery acceleration. These values are not supplied by the
accepted `PlayerRunnerDecisionMotionModel`. Adding intake for an established
parameter set is ordinary implementation; inventing the values is not.

`ActualRunnerDecisionInput` explicitly retains
`runner_live_context_unavailable`. Its current known-context contract covers
current bases 1/2/3 and next bases 2/3/4. A batter home-to-first start needs its
own issued intent and observation/knowledge provenance. Protected pre-pitch
waiting semantics do not supply that live decision.

### Operative catch call

The retained audit found a first-base timing perception law, but no defined
catch-specific umpire perception/calibration law. A general ledger can record
an accepted action; that does not make the ledger the producer of that action.
The supported alternatives are to bind a genuinely accepted official action
under its established authority, or implement an already defined catch-call
policy once its required observation and calibration contract is present.
Neither route may inject the correct catch rule as the umpire's perceived
result or counterfeit a ground cue to reuse a timing comparator.

## Workload and terminal ownership

The reserved same-PA terminal settlement already aggregates ten participants'
TOTAL activity and must remain the single writer for those participants.
Connecting a fair closure must not charge the same play again through a
legacy ActualLive workload route. The existing ActualLive closure proposal
itself retains
`actual_role_effort_policy_and_application_unconnected`.

The current reserved lifecycle outcome supports count-terminal and untouched
foul. Its terminal endpoint and transition remain non-live walk/strikeout
contracts. A future live branch must bind the real end, operative ruling,
communication and existing workload result coherently before it claims a
terminal scoring application. The new catch projection and strict scoring
contract are independently useful pieces of that connection, not completion
of the reserved fair terminal route.

## Follow-on Native binding audit

The field-rule reader now returns the original Match and contact timeline in
the same authenticated current/historical read as its complete physical
prefix. Its optional fair-catch rule basis contains the original batter,
actual catch/territory moments and the standard empty-base correct ruling.
It retains later pending contacts and possession work. `physicalEnd` and
`operativeCall` remain null: a correct ruling is not an issued umpire action.
The accepted view reference remains the input authority; no second caller
payload supplies the Match, timeline, physical facts or ruling.

The following two interfaces were absent at the `4d6adab` checkpoint:

1. A reserved live-catch operative-action owner, with its genuine assignment,
   original call/perception/policy/rule-evidence references and actual
   called/available times. Existing accepted actions cannot be relabeled:
   [SamePlateAppearanceLifecycleOutcome.ts](../../src/host/world/SamePlateAppearanceLifecycleOutcome.ts)
   limits original judgments to `foul` and `count_result`;
   [ActualPostPlayReviewSource.ts](../../src/host/world/ActualPostPlayReviewSource.ts)
   only requests review of an existing call. The generic
   [PlayAdjudicationLedger.ts](../../src/core/adjudication/PlayAdjudicationLedger.ts)
   explicitly leaves authentication of owned-call references to Native.
2. A reserved original producer/consumer census that can feed the existing
   physical-end finalizer. The exact current reserved view proves its owned
   work prefix; it does not certify unknown live-call producers complete.
   [SamePlateAppearanceLifecycle.ts](../../src/host/world/SamePlateAppearanceLifecycle.ts)
   then admitted physical/batting/outcome/reset work owners, while
   [ActualLivePlayFence.ts](../../src/host/world/ActualLivePlayFence.ts) explicitly
   rejects a same-PA reservation at legacy ingress. Adding a store or copying
   hashes would not authenticate an original admission or its due consumers.

These are code-owner/interface gaps, not a claim that the empty-base catch
needs home-to-first runner motion, a new scoring formula, or a user decision
about ordinary adapter code. Automatic catch-call generation would still
need an established perception policy; a genuinely accepted official action
could instead provide its actual action and timing without inventing a model.

Direct legacy reuse fails specific executable checks:

- [ActualFirstBasePlayEndEvidenceFromSqlite.ts](../../src/host/world/ActualFirstBasePlayEndEvidenceFromSqlite.ts)
  requires its registered scope/admissions (lines 40–73), first-base race and
  retained quantizer boundary (75–98), operative retirement (143–154), and
  emitted/due-consumed original-recipient communication (163–177).
- [ActualLiveAdjudicationFromSqlite.ts](../../src/host/world/ActualLiveAdjudicationFromSqlite.ts)
  reads only the sealed first-base end and rejects non-grounded evidence
  (32–59); its appeal applicability is also specific to that route (81–82).
- [ActualCallCommunication.ts](../../src/host/world/ActualCallCommunication.ts)
  accepts a durable first-base call (71–82) and emits only its already-issued
  action (96–104). Its existing exact reception law can be reused once the
  reserved call, sender pose, receiver conditions and body prefix are owned.
- [SqliteOfficialScoringWriter.ts](../../src/host/SqliteOfficialScoringWriter.ts)
  authenticates a durable official application (71–109), but that receipt
  does not itself rederive the independent physical-end producer. Merely
  adding a fair-catch callback there would not close this ownership gap.

Once those two interfaces exist, the already implemented physical read
binding, Core projection/scoring and existing reception/closure mechanics
can compose without charging the reserved TOTAL workload twice. No terminal
endpoint or scoring write is advertised before that connection exists.

## Owned explicit catch action and reception batch

The explicit-input route now owns an actual accepted umpire action separately
from the correct catch evidence. `SamePlateAppearanceCatchCommunicationSource`
authenticates original umpire Person identity, assignment, enrollment, game,
play, pitch, action-view, exact call time, accepted-action policy and sender
pose. Both `caught` and `not_caught` remain the supplied original judgment;
neither is required to equal the physical answer. This is not an autonomous
catch-perception model.

`SamePlateAppearanceCatchWorkFromSqlite` installs a separate exact
`pa_catch_v1_work` namespace. Its acceptance snapshots those original inputs,
rederives the physical and reception dependencies on its private connection,
and admits one immutable work receipt. Follow-on receipts retain the original
action, assignment and Person, and any already bound reception model. They
cannot select another random stream or alter the call while advancing the
physical cut. Missing action/assignment/policy/pose never becomes a durable
pending row. An issued original call may be owned while reception conditions
remain explicitly unavailable.

The new owner participates in lifecycle claim discovery and complete prefix
coverage. A current view cannot omit it. Prefix replay changes only the owned
work reference; it preserves the physical cut, clock, ball, bodies and timeline.
Its final writer proof authenticates the historical predecessor plus the one
new complete work reference, so the post-insert stale predecessor is never
mistaken for a current view. Historical read and reopen use the saved original
inputs without consulting the external Source callbacks. Existing cumulative
participant TOTAL assessments remain the only workload accounting route.

Exact reception reuses `resolveExactCommunicationReception`, the original
pitch seed and executed receiver body segments. Content is unavailable before
the unrounded receive time, even if its quantized tick equals the current tick.
The optional `defender_observation_v1.catchWorkReference` binds an admitted
receipt at the same physical cut to the real observation's perceived
communications. A scheduled or dropped message adds no received payload. The
observation changes no physical state and does not claim controller retirement.

`SamePlateAppearanceLiveWorkCensus` inventories original sensory refreshes,
decision/first-step deadlines, actually consumed decisions, per-participant
primitive coverage, and pending capture/throw work. Deadlines compare exact
elapsed time. `SamePlateAppearanceAdmittedLiveWorkFromSqlite` pairs that census
with all owned catch receipts and their actual receiving observations in the
same immutable read phase. It retains each received actor's still outstanding
controller response and never equates a sensor read with a completed reaction.

### Remaining interfaces after this batch

- Received-controller coverage for every original participant remains required.
  [ReceivedUmpireDefenderReplanTypes.ts](../../src/core/sim/fielding/ReceivedUmpireDefenderReplanTypes.ts)
  describes original OUT/SAFE content; the existing calculation validates those
  payloads and explicit out/safe priority profiles in
  [ReceivedUmpireDefenderReplan.ts](../../src/core/sim/fielding/ReceivedUmpireDefenderReplan.ts).
  `caught` can support an operative batter retirement under ordinary rules,
  independently of correct truth. `not_caught` is not a SAFE-at-first call and
  cannot be cast into that payload. A catch-specific accepted profile binding
  may reuse the existing timing/priority kernels; this is remaining adapter
  work, not evidence that a new numerical model is needed. The owned caught
  action now has its ordinary OUT ruling recorded through the existing ledger,
  with independently resolved or unresolved rule truth and no PlayEnd. Its
  actually received OUT meaning is exposed separately from the original catch
  payload. The existing `world_received_umpire_defender_policy_data` owner can
  supply the exact out profile. The caught defender response lifecycle and
  physical motor adoption are now connected as described below. No profile
  values have been invented. The existing replan's batter branch explicitly returns
  `receiver_role_unavailable`; its defender branch requires an actually adopted
  predecessor motor, a policy profile, and exact issuance/reaction boundaries.
- The live-end producer must bind that complete original producer/consumer
  frontier and real physical command coverage to the existing finalizer.
  [2026-10-09-received-controller-terminal-handoff.md](../superpowers/plans/2026-10-09-received-controller-terminal-handoff.md)
  requires each due recipient's actual replan/decision/motor/adoption/handoff,
  plus independent rule consumption, retirement and physical seal. A call,
  received observation, zero speed or elapsed field horizon is not that proof.
  The newly registered census is usable input, not an assertion that unknown
  producers are complete.
- Once that end exists, the original official-window/closure, reserved terminal
  endpoint and strict fair-catch scoring binding are mechanical remaining work.
  The Core catch/scoring contract is already available; a first-base race pair
  is not a prerequisite of an independently secured fly catch. No new scoring
  formula or automatic first-base motion is demanded by this narrow catch path.

The IFN01 additions exercise one independent original `caught` action,
exact reception, mandatory next-prefix admission, actual receiving observation,
unchanged field/workload heads and callback-free owner reopen. They are authored
for the later consolidated Native gate and are **unrun** in this author batch.
The short Node 26.10.0 author group passed 40 tests: census 15, physical rule
evidence 9, action/reception/source continuity and operative meaning 10, exact storage 6. No full
compiler or Native fixture was launched for this change. Those short checks do
not certify the new durable full-file path or terminal completion.

The follow-on registration depends on the batter-run owner in `62474aae`.
`world_batter_run_plans` is now a mandatory prefix work owner, with its own
exact schema validator and Source parser. Its receipt advances no physical
clock. The admitted census retains the plan until authenticated
`batter_run_motion_v1` field steps reach its planned end in actual elapsed time.
The result's coverage bounds and planned end are never treated as executed
motion: an actual contact may stop a checkpoint earlier. This registration
receives its compiler and Native evidence only in the combined batch.

## Received caught OUT to original defender motion

`defender_catch_response_v1` is a zero-time physical-field work action. Its
references select the actually received original OUT observation, an original
defender decision and that decision's actually adopted motor. It reuses the
incumbent's frozen historical decision calibration, nominal Player/Person model
and original priorities. A calculation without actual motor adoption is not
an incumbent. A later replacement motor invalidates the old incumbent.

The existing `world_received_umpire_defender_policy_data` owner supplies the
explicit out profile. First live availability belongs to this actual response
cut; `acceptedAtDay` never supplies an intra-play timestamp. A missing profile
preserves the real received cause as semantic pending. Subsequent response
steps retain the original process, receipt, calibration, policy binding and
incumbent. Same-moment information order remains null when no original order
owner exists; the existing Core kernel then retains its explicit pending
state instead of guessing from Source names or prefix numbering.

The shared `deriveReceivedUmpireDefenderReplan` kernel selects only at its exact
decision boundary and preserves the first-step delay. `selected` before
`selectedAt` is a proposal. The ordinary physical motor path now accepts an
actually committed response, reauthenticates the specific field row that first
recorded `selectedAt`, and supplies that Source and exact moment as issuance.
The existing locomotion and physical checkpoint kernels perform adoption.
The new census distinguishes still pending response work from actual motor
adoption, and keeps per-body coverage and other participants' work independent.
A response cannot hide an unfinished capture or throw transfer, and a fresh
ordinary decision cannot bypass a still unadopted received response.

The IFN-only locomotion calibration explicitly declares 500 ticks of command
coverage before the first motor is executed. Its original 10-tick fixture
command could not cover the existing cognition and first-step delays. The
new accepted test input permits real physical cuts at those boundaries; it
never renews an expired command or chooses a physical outcome. The extended
Native assertions cover missing-profile pending, exact commitment, retained
issuer, actual adoption and its census. They remain unrun until the combined
gate. `not_caught` still carries no fabricated SAFE ruling. Batter received-call
semantics, complete producer closure, independent PlayEnd and final official/
scoring application remain outside this proved defender connection.
