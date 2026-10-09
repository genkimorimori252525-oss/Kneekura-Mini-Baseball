# Proposed Native received renewal connection

**Status: proposed contract for review; no motor implementation authorized.** The current callback-free qualification remains first. Baseline implementation is `231b1a7f` / source `2d22221b`, genuine harness `83b08a72` / source `bd5faa8b`. Revision-two checkpoint `521d97a895c209e1d16da217a0170eaed3424333eb51dbd0b1172e78efaff556` owns the actual pending work described below. Future execution requires the final closed reopen lineage and separately reviewed source/input/control pins.

## Outcome and fixed boundary

Connect one already selected received process to a Native decision, a motor calculated from its existing accepted model, and actual **zero-horizon command adoption**. The adopted command may change acceleration and controller authority at the same cut; elapsed time, positions and velocities do not advance. Stop with physical continuation explicitly pending. No positive-time execution, acquisition/throw operation, scoreboard/rule/terminal closure, other receiver consumption, model generation or new calibration.

The actual work is `renewal_adoption`, origin process `received-live-process-home-1-1`, current replan `received-live-process-home-1-2`, due tick **12030302**, selected `ball_handler` at the same tick. Its current physical Source is `received-input-reception-cut`, revision 10, base field `field-race-candidate-0`; the initial motor is `scheduled-motor-home-1`, adopted by `field-race-real-motor` (revision 6). The accepted model is `scheduled-locomotion-model-home-1`, capability `defender_locomotion_v1`, day 10, with the existing Player/Person/fielding linkage. Its calibration is reused by reference, including the accepted integration limit; no parameter is supplied by the new caller. Initial motor coverage ends at tick **13030293**; renewal must derive current per-role remaining coverage rather than assume that whole horizon is reusable.

Existing initial owners remain literal: `SqliteActualDefensiveDecisionStore` forbids replan/repeated issuance and received semantic cues; `SqliteActualLocomotionStore` admits only `initial_defender_step_v1`, one receipt/head per Player/pitch. A received renewal is not represented as another initial Source, a later initial-decision revision, or a fabricated legacy receipt.

## Reference-only Sources

All keys are exact, versioned and immutable. No caller supplies clock, target, command, selected candidate, model parameters, dependency snapshots, previous-result payload or write permission.

```ts
type RenewalEnrollmentSource = {
  sourceId: string; sourceVersion: string;
  capability: 'received_umpire_renewal_enrollment_v1';
  receivedEnrollmentSourceId: string; receivedReplanSourceId: string;
};
type RenewalDecisionSource = {
  sourceId: string; sourceVersion: string;
  capability: 'received_umpire_renewal_decision_v1';
  renewalEnrollmentSourceId: string;
};
type RenewalMotorSource = {
  sourceId: string; sourceVersion: string;
  capability: 'received_umpire_renewal_motor_v1';
  renewalEnrollmentSourceId: string; renewalDecisionSourceId: string;
};
// A new literal action of the existing physical execution owner.
type RenewalAdoptionExecutionSource = {
  sourceId: string; sourceVersion: string; baseFieldSourceId: string;
  previousExecutionSourceId: string;
  action: {kind: 'received_renewal_adoption_v1';
    renewalEnrollmentSourceId: string; renewalMotorSourceId: string};
};
```

Native enrollment derives and freezes the original runtime/24-admission anchor, all four received admissions, current replan/head, receiver/cause, exact physical/observation cut, issued incumbent decision/motor/adoption, current self and five role authorities, all-ten-Player composition basis, and the existing locomotion/decision/fielding model references and hashes. It requires exactly one current ready `renewal_due` process, one matching work item, the complete cut equality below, and no previous renewal claim. This first capability supports that actual exact-cut case; earlier, missed, tied, unsupported or differently timed work stays pending and rejects acceptance.

Cut equality means field-for-field equality of **`{originTick, elapsedSeconds, tick, ticksPerSecond}`**, not equality of quantized ticks. The selected instant, frozen/current physical instant, Native self, decision issuance, motor start and adoption input/output must all match that tuple; the bound observation retains the same exact instant. For the qualified case it is `{11180360, 0.849942, 12030302, 1000000}` in that field order. `movementStartTick` and work `dueTick` must equal its tick under the same authenticated origin/rate. Require safe nonnegative integer origin/tick, finite nonnegative elapsed time, and the exact accepted positive clock rate. At every locomotion/adoption boundary require `tick === actualDefensiveBoundary(at, ticksPerSecond)` **and** `elapsedSeconds === (tick - originTick) / ticksPerSecond`, as in the existing exact integer locomotion guard. Reject equal quantized ticks with different elapsed values, origins or rates; no tolerance, rounding, snapping or reconstructed replacement instant is allowed. Earlier evidence/availability instants keep their original values and are not relabeled as selection or issuance.

## Five separate durable renewal tables

Use the new fixed namespace `actual_received_umpire_renewal_` with exactly `enrollments`, `decisions`, `motors`, `heads`, and `admissions`. The old five received tables and four-row received journal retain their schemas and values; the v1 runtime row, membership and admission enum remain unchanged. No old journal gains sequence 5.

Every immutable owner stores Source PK/version, scope/runtime/receiver/cause/origin-process/current-replan/renewal-enrollment mirrors, canonical Source/snapshot JSON and hashes, and its predecessor/dependency references. Enrollment is unique per received enrollment, origin process and `(pitch, player)`. Decision and motor are each unique per renewal enrollment. The head is unique per renewal enrollment and `(pitch, player)`, with consecutive stage 1–4, latest journal/owner Source, decision/motor/adoption pointers, and the frozen original physical cut. The journal has PK `(renewal_enrollment_source_id, sequence)`, unique `(owner, source_id)`, all scope mirrors, immutable legacy and received-prefix digests, Source/snapshot hashes, previous receipt hash and receipt hash.

| Stage | Concrete writes | New state |
| --- | --- | --- |
| Enrollment | enrollment INSERT, renewal head INSERT, journal sequence 1 INSERT | Native decision pending |
| Decision | decision INSERT, exact renewal-head CAS, journal sequence 2 INSERT | Native motor pending |
| Motor | motor INSERT, exact renewal-head CAS, journal sequence 3 INSERT | Physical adoption pending |
| Adoption | physical execution INSERT, physical-head CAS, renewal-head CAS, journal sequence 4 INSERT | Adopted at the unchanged cut; physical continuation pending |

Expected change counts are **3/3/3/4**, excluding only the declared first-bootstrap DDL. Adoption's immutable record is the actual `batted_world_field_executions` row, not a second receipt asserting that an unexecuted command was adopted. It participates in the new journal under its existing namespace. No v1 runtime admission is appended for these renewal operations. New readers distinguish this explicit admission family when authenticating the new physical action; they do not retroactively credit the old runtime producer.

All five new schemas/index sets are absent or fully exact. Only first enrollment atomically installs the complete set; failure rolls it back. Open/read/retry are inert. Partial, case-aliased, unsupported or contradictory schemas reject without repair. A new Source/version, fork, second motor, duplicate adoption or missing current head cannot substitute for an identical authenticated retry.

**Family conservation and fresh-ingress discovery are separate contracts.** Keep `receivedDefenderClaims` and `receivedDefenderReferenceClaims` as the old five-table family census used by `receivedJournal` and historical old-owner lookup. `ActualReceivedUmpireDefenderJournal.ts` requires exactly `2 * journal.length + (journal.length >= 2 ? 1 : 0)` old claims: nine at its four-admission boundary, regardless of renewal stage. Never feed union claims into that count or add a renewal owner to its enum. The renewal journal has its own census: local enrollment/decision/motor rows, one head and its journal rows give 3/5/7/8 claims at stages 1/2/3/4. At stage 4 it separately binds exactly one namespaced physical execution row by Source/snapshot hashes and header lineage. That row is not an extra old-family claim. Cross-family dependency authentication remains mandatory without merging either family's conservation arithmetic.

## Decision, motor and adoption derivation

The new decision materializes the exact already owned replan selection, target, cause, timing and policy binding. It has its own decision namespace and issuance identity; it does not regenerate candidates or translate a received Source into the initial-decision schema. The old initial decision and head remain historical and byte-identical.

The motor uses current Native self at the frozen executed cut and `playerLocomotionModelEvidenceFromSqlite` for the exact model referenced by the incumbent. Require identical Player/Person/fielding/day binding and model hashes. Reuse the existing Core route/rating/trajectory calculations with explicitly owned received-decision facts; never cast or fabricate a v1 decision/motor. Any extracted mathematical helper must leave existing v1 inputs/outputs byte-compatible. Reject overspeed, unsupported vertical/rounding state or exhausted coverage; do not clamp, normalize or manufacture coverage. The command covers one accepted integration segment bounded by the model and every actual retained role authority. Preserve each role's declared relative command and coverage separately; the global active-command field alone cannot establish all five authorities.

The new physical action derives complete contributions for all ten Players from the exact predecessor: the enrolled Player consumes the new motor; the other nine retain their exact commands and authorities. It adopts at zero elapsed horizon. Check all fifty positions/velocities and retained geometry at that cut; only the receiver's authorized command/root acceleration and corresponding authority may change. Actual motor-adoption event/ownership must be derived by the physical owner and stored with its output. Unsupported pending operation/cursor state rejects; no other due work is silently discharged.

Physical metadata, archive, current kinematics and known-work readers gain only this new literal action/namespace variant. Its snapshot discriminator is `received_renewal_adoption_snapshot_v1`, with explicit renewal enrollment/decision/motor references and the derived composition, physical adoption and remaining work. Motor and decision references are namespace-qualified; the new root-authority owner is `actual_received_umpire_renewal_motors`, and the command-adoption kind is `received_renewal_adoption_v1`. Historical v1/v2 action formats and their original readers remain valid. The existing initial heads are not reinterpreted as the new active controller; current received control resolves through the explicit renewal head and physical adoption.

## Fence, locality and causal rank

Add a separate finite **union fresh-ingress census** over the old five plus the new five tables, and the new physical action references. Inspect each namespace independently, including case aliases: an absent old family must never short-circuit renewal or physical-action discovery, and an absent renewal family must never suppress old claims. Seed by authenticated game/play/pitch/runtime or exact namespace-qualified terminal references; follow declared Source/snapshot/history/head/journal references, including moved cached scopes and head/journal-only survivors. Original pitch-bound owners must resolve game/play-only ingress even when all extension cached scopes have moved. Shared Player/model/policy identity alone does not connect plays. Malformed namespace/metadata rejects unchanged; applicable valid or orphan claims block fresh ingress even when their referenced old enrollment is absent.

Use this union census at `ActualLivePlayFence` fresh-write/registration ingress, both first-base/foul terminal owners' scope and reference guards, and every old/new received enrollment bootstrap admission check. Keep historical family readers on their own family census. In particular, with all five old tables absent, a renewal enrollment, renewal head-only or journal-only claim, or a surviving new physical-action reference still blocks legacy fresh ingress and a new old-family acceptance. Check again inside the acceptance transaction **before any bootstrap DDL**, so a claim arriving after preflight cannot cause old-family installation. Never create old tables, synthesize the missing old enrollment, repair a journal or treat a renewal orphan as pristine storage. Only truly absent applicable claims permit an otherwise valid original first enrollment. New renewal acceptance instead requires exactly its authenticated complete old-family claim set with no prior renewal claim or unexplained union claim; it cannot bootstrap the old family.

The physical adoption writer gets a **private, same-connection, transaction-bound grant** only after authenticating the exact pending renewal enrollment/head/motor and expected physical predecessor. The grant names the one action/Source, cut, stage and write set, remains under the write-owner savepoint, and is rechecked after each write. It is not a public flag, caller token, arbitrary owner allowlist or general fence bypass. No other legacy ingress uses it. Use an internal physical-owner write-on-connection path so the physical row/head and renewal head/journal commit together; no second connection, partial external accept or compensating repair.

Before any new motor/decision dereference from physical replay, metadata preflight proves the new physical revision strictly succeeds the motor's frozen self cut. The immutable read graph is `adoption revision 11 -> renewal motor -> renewal decision/enrollment -> received replan.read(R2) -> old enrollment/original evidence and explicit physical prefixes bounded at revision 10`. Replan predecessors are also read immutably; use neither `deriveCurrent` nor a replan acceptance path. Renewal self/composition derives from `scope(baseField, frozenPredecessorSourceId)`, never an unbounded latest/current execution lookup. A renewal journal may inspect the later adoption row's Source/header/hash and consecutive lineage while reading an earlier renewal owner; it must not replay that later physical result. These bounds prevent `physical current -> renewal -> replan -> physical current` recursion and keep later Core payloads opaque.

Current qualification is a separate write-side proof. Before adoption, independently authenticate immutable dependencies and require physical head revision 10, the exact observation head/cut, old replan head R2, expected renewal stage, unchanged incumbent/model/role authorities and original admission prefix. Each independent proof retains its own transaction/read guards. During the four adoption writes, a private staged-write token admits only the specified physical row INSERT and head CAS from 10 to 11, then renewal head CAS and journal append; after each write, verify the exact permitted row/head state and counters against that token. Post-write and post-COMMIT readback prove the new row from the bounded predecessor and check head 11, renewal stage 4, immutable dependency conservation and full cut equality. **Do not call old `receivedEnrollmentEvidenceFromSqlite(...).qualifyCurrent` after the physical head advances**, and do not weaken it to accept revision 11 for the old enrollment's revision-10 anchor. Historical reads and identical retries at stage 4 use immutable `replan.read`/bounded prefixes; any current-work projection checks the new head separately. An unexpected physical head, observation, role/model mutation or extra write fails; the expected adoption transition is not permission to ignore current state.

All independent preflight, write-phase, post-write and committed-row proofs retain Native main-only storage, query-only/savepoint restoration, ownership sentinels, exact counters/schema conservation, Source callback identity, retirement and honest uncertain-commit reporting. Any reuse is confined to one already authenticated proof; no cross-call cache or cached substitute for original ownership.

## Pending-work projection and acceptance tests

The original Core process and its historical `renewal_adoption` result are immutable. With no renewal enrollment, the existing current-work projection is unchanged. An authenticated renewal journal projects exactly one receiver-local next obligation: decision, motor, adoption, then physical continuation. Only an actual qualified adoption consumes that receiver's renewal obligation. The persistent received fence remains, and neither this record nor the remaining work proves quiescence or other-recipient consumption.

Required RED/GREEN boundaries: forged v1 re-issuance rejected; absent versus partial schemas; prospective membership/no past coverage; orphan/moved namespace claims; Source/model/current-cut/role mutation between proofs and after each real write; stale head/fork/double adoption; adoption failure preserving incumbent; real COMMIT/rebegin and cleanup failures with retirement/uncertain outcomes; historical reads opaque to later payloads; rank/cycle counterexamples; exact model/role coverage and zero-horizon conservation; exact 3/3/3/4 writes and callback-free reopen retries.

The review corrections require these specific discriminating cases:

- Admit each renewal stage while old `receivedJournal` still authenticates exactly nine claims/four admissions; extra old-family orphan rows still reject. Test renewal-family conservation independently, including stage 4's separately bound physical owner.
- With the old family entirely absent, place renewal enrollment/head-only/journal-only survivors (including moved cached scopes, declared-reference-only links and case aliases) and a physical-action-only survivor. Fresh pitch, game/play-only and terminal-reference ingress must reject, as must old first-enrollment acceptance before bootstrap. Repeat an applicable claim insertion between preflight and the transaction's pre-DDL census. Assert zero writes/schema creation and unchanged surviving bytes. A different play sharing only Player/model/policy stays disconnected.
- After adoption head 11, read/retry every earlier renewal owner, R2 and the adopted result without old `qualifyCurrent` or physical `current()` in any historical dependency traversal. Instrument those forbidden calls, inject rank cycles, and corrupt a later result while retaining valid required headers to distinguish bounded historical reads from current adoption qualification. Independently mutate the physical/observation heads and original dependencies between proofs to ensure freshness checks still reject.
- At selection/current/self/adoption input and output, mutate elapsed time while keeping the same quantized tick; separately mutate origin/rate and test an inexact integer locomotion boundary. All reject before acceptance (or fail/retire under the existing post-write uncertainty rules), while the genuine exact tuple remains admissible. Preserve per-role coverage tests and byte-identical v1 fixtures.

Genuine gates use only fresh private copies of the final qualified received checkpoint, retaining old evidence and actual accepted models. Their finite budgets follow measured work inventories; no root/call/reception rebuild or inherited budget enlargement is implied. This contract amendment is source inspection and documentation only; the union census and these Native tests remain implementation requirements, not a claimed runtime qualification.
