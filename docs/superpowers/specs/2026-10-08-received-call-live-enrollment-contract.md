# Received-call prospective enrollment and durable replan contract

2026-10-08. **Approved for bounded test-first implementation after independent review and the clarifications below. Genuine Native artifact execution remains separately held.**

Baseline: local `01f3e42cb994175e35fbff4451a2aeaae6586e68`, src `590703cb8ef0efad7c835b29ba4dbd827a5e4eec`; inert policy qualification is recorded in `docs/verification/2026-10-08-received-policy-data.md`. This contract incorporates all seven mandatory corrections from the independent continuation review. It grants no historical/runtime coverage, renewal executor, motor adoption or closure.

## 1. Exact accepted Sources and APIs

All objects are detached, recursively frozen exact-key inert data. IDs are nonempty trimmed strings; absent, extra, inherited, accessor, symbol and nonenumerable fields reject. No caller supplies a timestamp, sequence, hash, model, membership, receipt, intent or result.

```ts
type EnrollmentSource = Readonly<{
  sourceId: string; sourceVersion: string;
  capability: 'received_umpire_defender_enrollment_v1';
  runtimeSourceId: string; physicalPitchSourceId: string; playerId: string;
  observationSourceId: string; currentExecutionSourceId: string;
  predecessorDecisionSourceId: string; predecessorMotorSourceId: string;
  predecessorAdoptionSourceId: string;
}>;
type AvailabilitySource = Readonly<{
  sourceId: string; sourceVersion: string;
  capability: 'received_umpire_defender_policy_availability_v1';
  provenance: 'accepted_at_current_actual_observation_v1';
  enrollmentSourceId: string; policyDataSourceId: string;
  physicalPitchSourceId: string; playerId: string;
  observationSourceId: string; currentExecutionSourceId: string;
}>;
type ReplanSourceV2 = Readonly<{
  sourceId: string; sourceVersion: string;
  capability: 'received_umpire_defender_replan_v2';
  enrollmentSourceId: string; physicalPitchSourceId: string; playerId: string;
  observationSourceId: string; currentExecutionSourceId: string;
  predecessorDecisionSourceId: string; predecessorMotorSourceId: string;
  predecessorAdoptionSourceId: string;
  policySourceId: string | null; previousReplanSourceId: string | null;
}>;
```

New factories: `openSqliteActualReceivedUmpireDefenderEnrollmentStore(path, authority?)`, `openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(path, authority?)`, `openSqliteActualReceivedUmpireDefenderReplanStore(path, authority?)`. Each exposes only `accept(sourceId)`, `read(sourceId)` and `close()`. The respective authority method is `readAcceptedEnrollment`, `readAcceptedAvailability` or `readAcceptedReplan`, returning only its Source or null. Matching `...EvidenceFromSqlite(db)` readers use the caller's native main connection. No writable dependency callback is accepted. Add `receivedUmpireDefenderPolicyDataEvidenceFromSqlite(db).read(sourceId)` as a read-only native-main export over the existing private inert owner plus its exact schema checks; availability must share the live write transaction rather than open a second connection or decode its snapshot. The inert store API/data semantics remain unchanged. The export accepts only an actual Native main connection and requires an existing caller transaction. It performs no schema creation, accepted-input callback, second connection, authorizer installation, commit, rollback or close. Its read-only proof may create/release its own savepoint and temporarily strengthen query-only protection, but restores the exact entry setting, including ON, and preserves the caller transaction. A caller without a transaction rejects before reads.

The existing v1 `AcceptedActualReceivedUmpireDefenderReplan`, adapter, null policy/previous restriction and output remain byte/shape compatible. V2 authenticates original owners with that read-only v1 adapter, then derives its own input with the stable process identity, authenticated availability and historical previous Core result. It does not weaken v1 validation or initial decision/motor ownership.

## 2. Derived enrollment, membership and anchor

`Hash = SHA-256(actorJson(value))`; physical execution snapshots use the existing `ownedScheduledMotionArchiveHash` convention. `Ref = {sourceId, sourceHash, snapshotHash}`; an execution/observation/decision reference additionally has `revision`. `Moment = {originTick, elapsedSeconds, tick}` and `Cause = {physicalPitchSourceId, playerId, callSourceId, originCommunicationSourceId}` retain the existing exact Core shapes.

Enrollment reconstructs runtime/pitch, original Player/Person binding and fielding model; current observation and physical prefix; issued incumbent decision and its origin; actual motor/adoption, active command and all five role authorities; received communication and original call through the observation. Its exact derived value is:

```ts
{
  source: EnrollmentSource, gameId: string, playId: number,
  receiver: {careerId: string, playerId: string, personId: string,
    personLinkSourceId: string, fieldingModelSourceId: string, gameDay: number},
  cause: Cause,
  membership: {version: 'received_umpire_defender_membership_v1',
    receiverRole: 'defender', playerId: string,
    effectiveFrom: Moment, legacyCoverage: 'unchanged',
    physicalAdvancement: 'blocked_until_future_capability',
    producers: [EnrollmentProducer, AvailabilityProducer, ReplanProducer]},
  anchor: {
    runtime: Ref, originalPitchHash: string,
    legacyAdmissionPrefix: {count: number, digest: string},
    baseField: Ref, execution: Ref & {revision: number},
    observation: Ref & {revision: number}, at: Moment, ticksPerSecond: number,
    decision: Ref & {revision: number}, originObservation: Ref,
    motor: Ref, adoption: Ref & {revision: number},
    communication: Ref, call: Ref, decisionModel: Ref, contextualPlan: Ref,
    playerBindingHash: string, fieldingModelHash: string,
    selfHash: string, activeCommandHash: string, roleAuthoritiesHash: string
  }
}
```

The three producer records are exactly `{producerId, owner, responsibility, playerId}`. Their IDs are `actorJson(['received_umpire_defender_producer_v1', runtimeSourceId, playerId, responsibility])`. Fixed owner/responsibility pairs are:

- `actual_received_umpire_defender_enrollments` / `received_process_admission`
- `actual_received_umpire_defender_policy_availabilities` / `received_policy_availability`
- `actual_received_umpire_defender_replans` / `received_decision_and_renewal_obligation`

No producer replaces the original actor-decision or motor producer. The last owns the *obligation* only. This separate literal union never extends `ActualLiveProducerDomain`, `actualLiveAdmissionOwners` or the legacy membership. There is no table-discovered manifest.

Enrollment requires the original v1 runtime, the receiver's current observation and current physical cut to agree exactly, and an actually received call. Scheduled reception is outside this enrollment capability; the unchanged v1/Core scheduled result remains available. Exact ties or older information never become a synthetic trigger/selection. Enrollment has one immutable row per `(physicalPitchSourceId, playerId)` and per `(runtimeSourceId, playerId)`, permanently bound to its derived cause. Another cause cannot replace it.

The admission digest is over the original owner's canonical ordered array of `{sequence, owner, sourceId, sourceHash, snapshotHash}`. The count is captured under the enrollment transaction; historical replay uses that frozen bound, verifies every prefix entry and its original row, and compares its index/journal mirrors. No later suffix gains coverage from the digest. This capability prohibits a legacy suffix on current admission.

## 3. Owners, journal and one outstanding obligation

Exactly five new tables, with exact schema/PK/UNIQUE/index validation and no triggers, views, extra columns or shadow authorities:

1. `actual_received_umpire_defender_enrollments`: immutable Source PK; scope/runtime/receiver/cause and legacy-prefix mirrors; canonical Source and snapshot JSON/hashes; unique receiver keys above.
2. `actual_received_umpire_defender_policy_availabilities`: immutable Source PK; enrollment/scope/receiver/policy-data/execution/observation mirrors plus canonical JSON/hashes; unique enrollment (one availability).
3. `actual_received_umpire_defender_replans`: immutable Source PK; enrollment/scope/receiver/cause/origin-process/previous/availability mirrors, revision and canonical JSON/hashes; unique `(enrollment, revision)` and `(pitch, player, revision)`.
4. `actual_received_umpire_defender_replan_heads`: PK `(pitch, player)`; unique enrollment and source; origin process, cause and consecutive revision mirrors. A fresh origin requires no row/claim/history; revision two uses exact previous Source/revision CAS, changing exactly one head.
5. `actual_received_umpire_defender_admissions`: PK `(enrollment_source_id, sequence)`; unique `(owner, source_id)`; immutable `game_id, play_id, physical_pitch_source_id, player_id, runtime_source_id, owner, source_id, source_hash, snapshot_hash, legacy_prefix_count, legacy_prefix_digest, previous_receipt_hash, receipt_hash`.

Journal hashing excludes only its own `receipt_hash`; first `previous_receipt_hash` is null and every successor hashes its immediate predecessor. Journal sequence is a persistence dependency edge, never Core information order. Supported journal states are exactly: `[enrollment]`, `[enrollment, replan1]`, `[enrollment, replan1, availability]`, `[enrollment, replan1, availability, replan2]`. All five absent is a pristine namespace: read/open returns no extension claim without creating schema, and a proposal can be derived before installation. All five exactly installed and empty also mean no enrollment. Partial preexisting schemas, views/triggers/shadows, orphan rows/heads/journal claims, gaps, duplicates, missing required tables and unknown owner/version claims reject unchanged; CREATE IF NOT EXISTS must never repair them. Only first enrollment new-acceptance may atomically install all five tables and automatic indexes in its write transaction, and a failed first acceptance rolls that setup back. Availability/replan, read/open, failed Source lookup and historical retry cannot initialize anything.

Enrollment and journal row 1 atomically establish a persistent physical/terminal fence and this projection:

```ts
{kind: 'received_enrollment_pending', sourceId: enrollmentSourceId,
 sourceHash: string, cause: Cause, reason: 'process_not_admitted' | 'no_core_work'}
```

It exists even when there is no installed process/head row. A process with exactly one Core work item atomically replaces that projection with `{kind: 'received_process_work', originProcessSourceId, revisionSourceId, revisionSourceHash, cause, work: CoreWork}`. A Core result with no work retains the enrollment projection with `no_core_work`; it never certifies quiescence. There is exactly one current obligation, while immutable revisions retain source-qualified historical results. No fence removal is implemented.

## 4. Availability and process results

Availability requires journal state 2, authenticates the existing inert policy via its original owner, and requires exact enrollment Player/Person/model binding, `fieldingModel.acceptedAtDay <= policy.acceptedAtDay <= gameDay`. Observation and execution are still the current heads and exactly the enrollment cut; caller references must equal the enrolled references. Its exact value is `{source, enrollmentHash, policyDataHash, observationHash, currentExecutionHash, availableAt, policyData}`. `availableAt` is freshly derived from the equal observation/physical cut. Inert data alone cannot supply it or backdate it.

A durable process value is exactly `{source, revision, originProcessSourceId, history, enrollmentHash, previousReplanHash, policyAvailabilityHash, dependencyHashes, input, replan}`. `history` is the consecutive bounded Source array; nullable previous/policy hashes correspond exactly to the Source references. `dependencyHashes` retains all eleven named v1 adapter hashes. `input` and `replan` are the existing complete Core types. Revision 1 has null previous/policy and sets `originProcessSourceId = source.sourceId`; every Core evaluation uses that same origin ID, so work identity never changes with revision Source ID.

Revision 2 is the only allowed fresh successor: exact current head is revision 1, previous policy is null, the one availability was journaled after revision 1, and the Source explicitly references it. All enrolled references/cause/model/plan/incumbent/origin evidence and exact cut remain equal. Core must support the previous result (`communication_received` with scheduling); ties/no-new-trigger remain pending and cannot be rebound into a synthetic revision. Changed Source versions alone, no-op new Sources, repeated null policy, policy replacement, moved cause, fork, stale head, second active receiver process and revision 3 reject. Identical Source retries write nothing, including after authority-free reopen.

Core owns timing and candidate selection. Both information-order fields remain null. Selection commits only at its original exact decision boundary; a later first ready result stays `missed_commitment` with unconsumed decision work, and a proposal before the boundary remains uncommitted. Selection and replacement of decision work by intent/renewal work are one transaction. Original motor, active command, five role authorities and execution stay exact regardless of selected intent.

## 5. Current ingress versus immutable replay

A small metadata-only `ActualReceivedUmpireDefenderClaims.ts` discovers relevant extension claims across all five namespaces by indexed columns, decoded raw Source/snapshot identities, all history identities, anchor runtime/pitch/receiver mirrors, head and journal scope. Malformed JSON or unsupported owner schemas conservatively reject; escaped keys, duplicate leaves/containers and conflicting aliases cannot make relevant ownership disappear. This discovery never replays a received process or calls physical `current()`.

Claim discovery is a finite namespace-qualified graph closure, not a top-level scope query. Seed original runtime/pitch identities from requested pitch or authenticated game/play context, using original ownership metadata (including raw aliases), and reject unknown/contradictory resolution. Follow fixed Source/reference links across all five extension namespaces until no new related identities appear: enrollment, prior/origin process, availability, row/head and journal `(owner, source_id)` links, in both directions as needed. A moved scope or deleted enrollment cannot hide its related head/journal. Surviving runtime/pitch/execution/observation/incumbent decision/motor/adoption/communication/call references, including declared anchor mirrors, resolve in their original namespaces and connect the claim to the actual play even if all cached scopes moved. Shared Player/Person/fielding-model/inert-policy identity alone never connects plays. Enumerate escaped/duplicate leaves/containers before canonical interpretation; ordinary JSON.parse is not discovery authority. Undecidable malformed/partial/unsupported state may conservatively reject. Any applicable valid or orphan/corrupt claim blocks fresh legacy ingress.

Every fresh legacy `beginActualLivePlayWrite`/registration, including pitch-scoped and game/play-only callers, checks that discovery and rejects any applicable claim. All v1 owner admissions are conservatively blocked for the enrolled play, preserving the entire old journal; this includes every existing physical action wire and nonphysical legacy admission. Recheck after producer/head/journal writes through the same legacy fence state. Both first-base and foul terminal fresh acceptance paths invoke the same assertion before and inside the transaction and after each write. Relevant orphan/corrupt state rejects rather than falling back to v1. Initial input schema checks may reject earlier; no physical/terminal INSERT can bypass this guard.

New extension writes use a separate fence with the fixed owner set above and the existing closure-claim census. They authenticate current physical/observation/decision heads, active command/roles, exact legacy prefix and count, current extension graph/obligation and expected journal state. No new owner is sent through the v1 admission writer.

Historical `read`/identical retry replays only original observation, bounded physical prefix, enrollment prefix, policy and requested process ancestors. It uses original owner historical readers; it never invokes current admission, known-work, queue or closure settlement. Later revision payloads stay opaque: only canonical metadata/hash/header/head/journal continuity is checked past the requested bound. A missing/corrupt head or ownership contradiction still rejects. Physical `current()` continues to authenticate only the physical head, never the received process. The call graph is acyclic: extension current qualification → original historical replay + original current-head check; legacy ingress → metadata discovery → rejection.

## 6. Transaction protocol and conservation

On new acceptance: validate Source; derive read-only proposal; acquire `BEGIN IMMEDIATE`; install all five schemas only when the entire namespace is pristine, validate the exact schema/index allowlist and freeze schema state before setting the row-change accounting baseline; freshly rederive originals, callback Source and all current/closure/claim expectations under the same query-only, change-accounted proof and reentrancy guard; insert immutable owner row; insert or CAS head when applicable; append the one extension journal row; reauthenticate originals/closure/conservation after each potentially mutating statement against the explicitly staged write token, then require the complete graph after journal insertion; prove the exact new graph and untouched anchor; commit; verify the exact own durable rows without invoking callbacks after commit. A trigger/fault introducing closure, changing the incumbent/dependency/legacy journal/Source/own result, replacing the transaction or writing unrelated state fails and rolls back.

Read proofs use query-only savepoint scopes, exact change/schema counters and main-only storage. New-write change deltas are enrollment 2, replan1 3, availability 2, replan2 3 (the latter includes one head update). Initialization permits only the five declared schemas and automatic indexes. No other writes, schema changes or old rows are permitted. Reentrant callbacks, exceptions after acquired BEGIN, rollback/cleanup failure and COMMIT replaced by ROLLBACK are tested; cleanup failures retire the handle. Post-commit verification can detect a replaced/failed commit but cannot roll back a commit that genuinely succeeded. Any post-commit verification failure retires the handle and reports an uncertain/failed operation; subsequent retry resolves durable authenticated rows without duplicate writes. Do not claim every post-commit error rolled back. Successful retries have zero changes. All older tables, 24 admissions, runtime bytes and physical/observation/decision/motor/adoption heads remain exact.

## 7. TDD gates and final boundary

- Source/API RED, then behavioral RED/GREEN for immediate enrollment fence without process; derived binding/anchor/membership; current-cut/day availability; fixed ledger graph and stable origin/work identity; null-to-policy selection at the exact boundary.
- Ownership/transaction cases: stale current references and CAS, changed callbacks/original dependencies, second receiver cause/process, new-Source no-op, forks/rebinding/revision 3, missing/orphan/unsupported/hidden/escaped/duplicate claims, post-insert closure/claim changes, read-proof writes, unrelated write/schema mutation, rollback and failed commit durability. Verify all row/write deltas and reopen both revisions.
- Bootstrap/evidence cases: pristine read/open leaves all schema unchanged; successful first enrollment atomically adds exactly five owner schemas/indexes and row/journal; failed first acceptance restores all-five-absent; partial sets reject unchanged. Same-connection inert evidence reads preserve existing OFF/ON query-only and transaction state, reject missing transaction/non-native/attached/temp-shadow connections, and authenticate committed inert data without its writable store.
- Claim-closure cases: moved index columns on game/play-only ingress; Source-only surviving original pitch/runtime/execution references; head-only and journal-only claims; availability/replan linked only through enrollment or prior/origin Source; conflicting escaped/duplicate aliases; unrelated play sharing Player/policy. Test pre-process, semantic-pending and renewal-pending states.
- Direct guard coverage includes each literal v1 admission owner, game/play-only ingress, all `SqliteBattedWorldFieldExecutionStore` action families, both terminal stores, enrollment-only/semantic-pending/renewal states, and hostile partial namespaces. Historical v1 and revision-1 reads remain valid with later received metadata and never execute later process payloads. Exact ties, scheduled/no-new-trigger and before/after-deadline results retain Core semantics.
- One separately reviewed capped genuine private-copy gate starts from the qualified inert-policy result (SHA-256 `3e21f81b1cbaef5cc1148b1e7c39d38ab70d5e24bc89535ed739486067779158`); authenticate the surviving 36-file chain without rerunning root/call/reception. Enroll at execution 10 / observation 3, accept null-policy revision 1, accept fixture availability, accept revision 2, reopen/retry and independently inspect exact schema/row deltas. Original 69-table/135-row baseline plus the inert policy table/row, all runtime/admissions and heads remain unchanged. Existing legacy store constructors can initialize their own tables; guard tests separate that fixture setup from measured blocked acceptance. The genuine positive gate must not open unrelated terminal stores and silently add their schemas; only five extension schemas and ten row changes are allowed.
- Genuine expected Core result: current `{originTick:11180360, elapsedSeconds:0.849942, tick:12030302}`, selectedAt and first-step tick `12030302`, `ball_handler`, phase `renewal_due`, one `renewal_adoption` work item with the origin process ID. OUT `(0.1,0.9)` and SAFE `(0.9,0.1)` remain explicitly synthetic; baseline pursuit dominates, so hold is never forced.
- Finite Native gates use pinned dependency/runtime/control inputs, one worker, 1024/1120/2048 MiB heap/measured/RSS; full compiler 1408/1504/2048 MiB; 4 GiB live reserve and 6400 MiB launch floor. Reuse the exact generated catalog only after its 15 inputs match; no expensive tests rerun for bookkeeping. Existing full-suite claims are not invented; parent reviews each new genuine runtime release separately.

Stop at the durable decision and honest unconsumed renewal obligation. Keep `received_call_controller_consumption_pending`; other recipients remain unconsumed. No new motor, physical advancement, queue settlement, SAFE/PlayEnd/official closure, new calibration/model generation, UI, home-PC CI, merge or deployment is part of this change.
