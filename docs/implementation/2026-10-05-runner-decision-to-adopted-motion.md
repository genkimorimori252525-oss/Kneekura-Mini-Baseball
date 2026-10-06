# Runner owned decision to adopted field motion

This source contract maps the next executable connection within remaining-plan
§5 item 7. It preserves P6's individual information/choice boundary and runtime
contract 06 §§2–4's original kinematics/controller authority. The preceding
history/model candidate is not yet accepted; this document changes no production
or tests and claims no newly executed decision or motion.

## Separate input, choice, issuance and execution

The decision owner must consume original durable observation/knowledge, owned
perceived cues and an explicit runner model. A caller may provide immutable
Source references and an accepted work horizon; it cannot provide a chosen
action, received-event DTO, forced flag, tag-up state, route root or result.

The original-public receipt supplies the permitted pre-pitch outs/score/inning
and base reference. A complete live `RunnerKnownContext` additionally needs
authenticated current force/tag-up information. Race/threat cues need their own
perception-derived availability/confidence and producer coverage. No generated
cue is not equivalent to evidence that a base is uncovered. Unsupported umpire
OUT/SAFE content cannot be relabeled as coach instruction.

When all required inputs exist, retain `RunnerDecision` priority: retouch,
tag-up wait, current-base threat, force, received coach instruction, then
perceived next-base race. The explicit model supplies the existing confidence,
trust, margin, ability and runner timing parameters. The owner records input
hashes, original information identities, runner/controller revision and decision
epoch. Missing model, knowledge or cue coverage remains a named pending cause
before a Core choice is attempted.

An ordinary continuation advances the same pending decision. It cannot alter its
input set or issue it twice. A new decision from later information requires a new
epoch with an explicit predecessor and future-controller invalidation boundary.
The initial executable slice may reject unsupported replan branches while
preserving the issued original; it must not silently replace them through retry.

## Exact availability and existing timing

`RunnerDecisionTiming` uses integer ticks; field and reception receipts preserve
exact elapsed moments. `ActualDefensiveContext.ts:actualDefensiveBoundary` already
finds the first safe integer clock boundary at or after an exact moment using the
physical clock comparison itself. Its algorithm avoids multiplication/ceil
rounding errors. Reuse or neutrally factor that clock conversion without changing
the defender output or selecting a new rounding tolerance.

The Native decision must save actual information-consumption availability and
decision start separately from a sample's older capture tick. It cannot backdate
new cognition merely because stale memory has an old `observedAt`. The existing
defensive owner is a precedent: selection, actual start, decision delay and
issuance are separate saved facts. The runner connection needs explicit tests
for this same authority boundary before selecting its implementation.

Core runner choice currently combines selection with timing in
`decideRunnerMotionIntent`. If Native needs selection separately to anchor
cognitive timing to actual owned consumption, factor its existing selection
without changing the legacy function's results or priority. Then call the
existing `resolveRunnerDecisionTiming` at the owned start. Do not silently edit a
returned intent timestamp, invent an alternative delay law or claim a past
physical reaction from a late-created receipt. This API factoring is a planned
contract, not an implementation in this tranche.

A decision receipt may be pending cognition, an issued intent awaiting motor
reaction, or ready for adoption. `RunnerMotionParameters.reactionDelayTicks`
remains a separate physical latency; no defender first-step calibration enters
this path. Both exact information availability and the existing integer due
boundaries must be reached before the corresponding receipt is emitted.

## First compatible controller adoption

The first bounded physical connection retains the existing straight upright
route and the original five-part body decomposition. It consumes an actually
issued runner intent, the original explicit model, current owned kinematics and
the previous field/controller identity. The model's initial motion tuple must
match the original pre-pitch runner parameters; saving a different model does
not retrospectively change accepted motion.

`ActualPlayerKinematicsFromRunnerFieldPieces.ts` supplies the actual root, five
relative part states and canonical rounding residuals. The body primitive center
must not replace the root. Reuse `RunnerLocomotionController`, `RunnerMotion` and
the existing analytic segment/field kernel. Do not relabel the defender motor
owner, create a second running engine, or snap the runner to a base/path origin.

The current kinematics receipt does not itself expose active drive direction.
The bridge must authenticate drive and body mode from the original controller
piece that actually executed and its same-time ownership order. Speed sign is
insufficient: a moving runner may be braking with neutral drive or still reacting
to an earlier intent. At an exact reaction/phase endpoint, a nominal next segment
must not stand in for an adopted physical phase. The contract must distinguish an
already executed phase transition from pending same-time control work before
constructing `RunnerMotionState`; an ambiguous boundary remains pending.

The current Core controller authority takes an integer canonical tick. A
fractional field/reception cut is insufficient for adoption by itself. Progress
the existing original controller through genuinely executed field continuation
to a compatible integer boundary, within already accepted coverage. If contact
interrupts that progression, resolve the real boundary through its existing
owner or remain pending. Never sample the nominal future trajectory and call it
executed state, round backward to `ball.tick`, or skip a zero-time contact.

At adoption, prove root position/velocity/body mode, route-distance projection,
signed speed and old drive against the executed canonical state. Establish the
new controller revision using the existing continuous physical-engine rebase
contract, preserving state. This invalidates old future controller authority
while leaving executed history readable. An equal-tick replacement has its own
deterministic sequence; it cannot invent a base touch or remove a simultaneous
physical contact.

`RunnerMotion` must retain old drive until the new intent's actual motor reaction
boundary. If adoption occurs after that boundary, still begin from the current
executed state; never replay the new acceleration into the elapsed past.
`advance`, `retreat` and `hold` remain physical acceleration/braking behavior.
Core `slide` may be selected, but the current upright five-part field capability
cannot execute it until a compatible body-mode producer is owned.

## Field continuation and coverage

Use a distinct versioned field capability for an adopted decision/controller.
The retained-piece v1 Source explicitly promises the original pre-pitch runner
revision; it must not silently host another controller. Its existing reads,
hashes and downstream unsupported-consumer fences remain unchanged.

The new field row references the issued decision and adoption receipt. It derives
the runner's five analytic curves and carries exact per-piece provenance. The
other ten actors/fifty parts retain their existing accepted curves and commands;
their coverage must actually include the requested endpoint. Do not extend their
end ticks because only the runner received a new intent. Additional independent
actor coverage requires its original owner.

The existing field kernel determines the first actual collision/boundary and
cursor. Endpoints exactly on a phase boundary record only pieces that actually
executed. Zero-time contacts cannot be skipped by adopting a later phase. Route
exhaustion, off-route state, unsupported sliding or missing coverage remains an
explicit handoff, not a hidden hold, result or new general PlayEnd capability.

## Proposed Source and test map

| Source/test path | Contract |
| --- | --- |
| `ActualRunnerDecision.ts`, `SqliteActualRunnerDecisionStore.ts` | Owned observation/knowledge/cues/model; unchanged Core choice; exact consumption/start; pending/issued lifecycle; epoch and immutable retry |
| `ActualRunnerDecision.test.ts` | Complete-input Core-equivalent choice; original known facts; missing inputs pending; received-coach priority; unknown force/tag-up never defaulted |
| `ActualRunnerDecisionTimeBoundary.test.ts` | Old memory capture versus newly owned consumption; zero cognitive delay at fractional time; equal rounded tick with distinct availability; safe clock exhaustion; no early issuance |
| `ActualRunnerMotionAdoption.ts` | Issued original decision plus actual self/model; existing reaction and compatible controller basis/revision; original body decomposition |
| `ActualRunnerMotionAdoption.test.ts` | Integer-cut positive; fractional pending until actual continuation; before/exactly/after reaction; inherited velocity and independently authenticated old drive; executed versus nominal next phase at exact endpoints; stale controller rejection; route/body-mode/coverage fences |
| Versioned field execution and its Source tests | All 55 curves; retained ten actors; actual runner adoption; multiple analytic phases; exact phase end and real zero-time collision; unchanged old rows |
| Separate Native acceptance | Genuine durable information -> decision -> issued intent -> adoption -> executed field result, followed by full-close replay, retry and witnessed rollback |

Core fixtures with explicit synthetic knowledge can verify the selection/timing
and motion algebra. Mocked decision/knowledge readers can verify small Native
authority boundaries, with substitutions clearly labeled. Neither is a genuine
end-to-end knowledge-consumption proof. That acceptance waits for the actual
semantic producers; no current hidden rule truth may be inserted to complete it.

Adjudication contract 07 §2.1 permits only later-intent changes after reception.
The current received-call end fence stays until each required recipient's real
controller consumption exists. Section 9's post-closure `rule_system` reset is a
different transition. These contracts add no new closure, scoring, calibration,
UI or presentation requirements.
