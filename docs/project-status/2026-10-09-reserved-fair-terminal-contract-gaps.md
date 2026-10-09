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
