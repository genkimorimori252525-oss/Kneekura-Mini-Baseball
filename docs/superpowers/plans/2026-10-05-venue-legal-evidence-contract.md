# Venue-bound settled-foul dead-ball evidence

Status: the pure Core implementation passed 55 focused cases and full compilation on `71bb6da`. The genuine original foul-stop fixture and complete file close/reopen passed on `243d32d`. The accepted Native policy owner is now an implementation candidate after its observed `735bea7` behavioral RED, with independently reviewed main-only connection and single-row write corrections at `fa159f3` now verified by 44 policy/boundary cases and full compiler. The original three-pitch count fixture has now passed its real setup assertions. Original-count and observation implementations are candidates after their observed scaffold REDs; their GREEN gates remain unrun. Earlier import/behavioral RED and the first fair Native failure remain distinct records.

Base: `cda9f4aa1f32d3f46dfb1ef9dc3114b9f014693e`. Isolated branch: `codex/venue-legal-evidence-contract-2026-10-05`.

## Intended outcome

Advance checkpoint §5 item4 by observing one already-supported legal consequence of authenticated physical history: an untouched batted ball actually rolls to rest in foul territory before both base gates. Preserve the exact stop and prior ground contacts; derive the dead-ball interpretation through existing Core rules under explicitly accepted venue/profile configuration.

This is an additive interpretation/evidence adapter. It does not apply the interpretation to the running World or Match, issue an umpire call, stop physical producers, produce `PlayEndFact`, close a play, update a count, place runners, or advance to the next pitch. Existing v1 first-base readers keep their present guards and pending facts. General runner and practice/learning work is separate.

## Source findings

- [Checkpoint §5](../../project-status/2026-10-04-nonvisual-implementation-checkpoint.md): item4 requires physical causes plus versioned policy and a separation of correct interpretation from official decisions.
- [Architecture05 §2.4–2.7 and §6](../../game-design/05-world-first-live-ball-architecture.md): preserve physical events and provenance; rule results do not rewrite the physical past; a result or horizon is not automatic PlayEnd.
- [Runtime06 §9–10](../../game-design/06-world-first-runtime-contracts.md): dead-ball consequences still require canonical generation/consumption and a settled watermark before closure.
- [Adjudication07 §1–3](../../game-design/07-world-first-adjudication-contracts.md): physical truth, correct interpretation, official ruling, and scoring remain distinct; unsupported interpretation stays unresolved.
- `SqliteBattedWorldContactStore.ts` authenticates original fixture, venue, Player/Person identities, physical model, and contact replay. `SqliteBattedContactResponseStore.ts` pins the same surface identities and separately accepted materials. These are existing owners, not new work.
- `BattedWorldFieldPhysicalPrefix.ts` authenticates the bounded field/execution chronology and original cursors. Its normalized frames are an interpretation view; original contact records remain in their physical archives.
- `BallWorldFieldTerritory.ts` already derives an actual rolling-stop territory through `resolveUntouchedSettledBattedBallTerritory`. It rejects unsupported stationary/ground evidence and does not use a horizon as a stop.
- `FoulBallRule.ts` already produces `uncaught_foul / ballDead: true` when foul territory is established and the ball was not caught. Bunt intent changes count/strikeout consequences, but not this dead-ball conclusion.
- `RuleProfile.ts` registers `npb-2026` revision `2026`; it contains no wall, roof, spectator, out-of-play-boundary, or interference policy. The Native original pitch stores the Match profile and its evolving plate-appearance timeline; its swing action does not own a bunt-intent fact. The frozen Match frame can retain an earlier count across multiple pitches.
- `ActualFirstBasePlayEndEvidenceFromSqlite.ts` explicitly requires grounded-fair evidence with no pending contacts. That condition must remain unchanged. `ActualFairFieldTimeline` and existing first-base adjudication must not adopt the new result implicitly.

## Why this category

The smallest positive category is `untouched_settled_foul_dead_v1`, not a wall impact or field exit. It needs no new stadium semantics, threshold, material, penalty, or calibration value. `BallWorldFieldTerritory` and `FoulBallRule` already supply its legal conclusions.

An outfield panel describes a finite physical collider, not a closed field-exit boundary. Contact with it cannot establish an over-wall exit, home run, award, or dead ball. Existing Core code has no supported general surface/interference interpreter to authenticate. Those categories stay unresolved until their policy and physical evidence contracts exist.

The first Native positive fixture must produce the foul rolling stop from original pitch/bat/field owners under an explicit `npb-2026` fixture profile. It may use a clearly synthetic incoming pitch direction before persistence, but must keep the accepted field geometry and use the existing physical solvers. It must not relabel a completed fair path, modify a saved contact, rotate geometry after execution, or inject a stop. The first candidate at `71bb6da` honestly produced a fair stop. The corrected original incoming velocity at `243d32d` produced an actual foul stop through the existing owners; both results and their receipts remain distinct.

## Exact supported interpretation

1. Validate the explicit policy's supported version and registered RuleProfile ID/revision; Native additionally authenticates all configuration identities listed below.
2. Derive territory by calling `deriveBallWorldFieldTerritory` on the complete original prefix, without filtering its contacts or acquisitions.
3. Resolve only if territory is `foul`, basis is `settling`, and the decisive frame is the original singleton `rolling_stop` with the exact returned `BallWorldMoment`.
4. Require an earlier owned ground frame and only singleton `ground`/`rolling_stop` frames through the decisive moment. No earlier/equal base, surface, actor, acquisition, or simultaneous event is admitted by this first version. Other supported Core categories remain visible but outside this narrow legal adapter.
5. Call `resolveFoulBallRule` with the original valid pre-pitch count and `flyCatch: null` for each possible `buntAttempt` value. These are explicit alternatives, never canonical bunt facts. Emit only the shared `uncaught_foul / ballDead: true` conclusion. Do not select, publish, or apply either count result. A future explicit batting-intent owner is required before selecting `foul` versus `foul_bunt`, including the two-strike case.
6. Preserve all original contacts through the requested observation cut, including later unsupported events. A later event does not erase the earlier correct interpretation; this does not authorize ignoring it at any closure boundary.
7. Every other category returns an explicit unresolved interpretation. A fair stop is not evidence that the ball is generally live. A foul-side airborne touch is not an uncaught foul. Missing policy is not a fair/live default.

## Proposed interfaces and files

### Pure Core contract

Create `src/core/rules/BallWorldSettledFoulDeadEvidence.ts` with:

`deriveBallWorldSettledFoulDeadEvidence({ field, count, policy })`

- `field`: existing `BallWorldFieldTerritoryInput`, unchanged and complete.
- `count`: original `PitchCountState`, supplied by Native from the accepted pitch's `batted_ball_pending` result timeline. Cross-check its count against that pitch's `BatBallContact.payload.countBefore` and `beforeTimeline.status.count`; never use the potentially stale count in the frozen Match frame. Profile identity still comes from `frame.match.ruleProfileId`.
- `policy`: exact shape `{ version: 'untouched_settled_foul_dead_v1', ruleProfileId, rulesRevision }`; only registered `npb-2026`/`2026` is initially supported. A caller-supplied RuleProfile object is never accepted.
- Return `{ version: 'settled_foul_dead_evidence_v1', territory, physicalContacts, interpretation, countEffect }`.
- `interpretation`: `{ kind: 'dead_ball', reason: 'untouched_settled_foul', moment }` or `{ kind: 'unresolved', reason }`.
- `countEffect`: always `{ kind: 'unresolved', reason: 'bunt_intent_pending' }` for the positive category; `null` otherwise.
- `physicalContacts`: the complete unmodified input frames, not a filtered proof.
- Reject extra keys, getters/non-inert inputs, unknown policy/profile/revision, malformed moments, and injected result fields. Return frozen values without mutating inputs.

The accompanying `BallWorldSettledFoulDeadEvidence.test.ts` is a test-first contract. Its bytes are preserved from the observed `a4c52e3` import-RED cut. The `0579b66` typed scaffold threw `SETTLED_FOUL_DEAD_EVIDENCE_NOT_IMPLEMENTED` for every input, allowing the behavioral assertions to run before a successful result was implemented. The current candidate composes existing territory/count/foul rules, preserves complete contact frames and keeps count/bunt consequences pending. These hand-authored Core frames test rule composition only; they are not Native ownership proof or production calibration.

### Immutable accepted Native policy

Create `src/host/world/SqliteBattedVenueLegalPolicyStore.ts` with `openSqliteBattedVenueLegalPolicyStore(path, authority?)`. The authority exposes only `readAcceptedPolicy(sourceId)`; the store exposes `accept(sourceId)`, `read(sourceId)`, and `close()`.

An accepted Source has an exact shape:

- `sourceId`, `sourceVersion`, `version: 'batted_venue_legal_policy_v1'`
- `gameId`, `careerId`, `fixtureEventId`, `venueId`, `availableAtDay`
- `baseFieldSourceId`, `worldModelSourceId`, `responseModelSourceId`, `fieldGeometrySourceId`, `baseGeometrySourceId`
- `rulePolicy`: the pure policy above

Acceptance loads the real field root and verifies every declared identity against its original flight/pitch, fixture, world model, response model, geometry and Match profile. `availableAtDay` must not exceed the original game day. It freezes the Source, all dependency hashes, and the registered profile hash in one own SQLite row. No caller-supplied hash, rule object, material, legal result, or contact is accepted. Reopening rederives and verifies the row and dependencies. The same policy version/scope cannot be rebound to different content; identical retries work without a live authority callback. Acceptance must account for exactly its single inserted policy row; a trigger that writes an unrelated current Match or live row must force rollback even when all historical dependencies are unchanged.

The Source's `baseFieldSourceId` is an accepted physical anchor, not necessarily the later observation cut. Freeze its owner, Source ID/version, integer revision, Source hash and snapshot hash. Uniqueness is per original physical pitch and policy version, not per game. The durable policy also pins play ID, fixture revision, the full registered RuleProfile hash, and hashes of the original pitch, fixture row, world model, response model, field geometry and base geometry. The observation's authenticated field prefix must contain the exact unchanged anchor; later, foreign or changed anchors fail.

The first Native contract cut at `735bea723134873172c6d59298988deacb583e50` contained a typed rejecting scaffold plus 37 policy-store cases. Its actual behavioral RED was 11 failures at `BATTED_VENUE_LEGAL_POLICY_NOT_IMPLEMENTED` and 26 rejection-only passes, with no skipped cases or fixture errors and unchanged source/control hashes. The latter passes do not establish validation. The ownership test also tries a different field anchor and Source version for the same pitch/policy version; the no-side-effect test preserves field rows plus live admission/PlayEnd/fence state. Source shape cases include mismatched IDs, unsupported outer versions, invalid days, nested result fields and getters.

The policy implementation candidate authenticates immutable prior reads before and after authority callbacks, repeats dependency derivation inside `BEGIN IMMEDIATE`, writes only its own configuration row, and rederives the complete stored row after insert triggers before commit. Reads use real SQLite snapshot transactions and the existing physical read traversal guard; an enclosing transaction stays open. Metadata ownership discovery includes source/snapshot claims so moved index mirrors cannot create a second policy for the same original pitch/version. The corrected policy owner subsequently passed 44 policy/boundary cases and full compiler at `fa159f3`. No successful observation adapter result is claimed yet.

This table is an interpretation configuration archive, not a physical producer or live rule consumer. It grants no runtime domain, changes no physical head/admission journal, and cannot unblock a v1 closure. Do not silently add it to existing first-base runtime allowlists. If its later use needs to change live action, that requires a separate versioned causal-consumption contract.

### Read-only Native evidence adapter

Create `src/host/world/BattedVenueLegalEvidenceFromSqlite.ts` with:

`battedVenueLegalEvidenceFromSqlite(db).read({ version: 'batted_venue_legal_observation_v1', policySourceId, baseFieldSourceId, executionSourceId })`

`executionSourceId` is an explicit string or `null`; omission is invalid. Read the accepted own policy. Load `battedWorldFieldEvidenceFromSqlite` and `battedWorldFieldExecutionEvidenceFromSqlite` on one transaction/snapshot, use their explicitly bounded scopes, then call `battedWorldFieldPhysicalPrefix`. Use `withBattedWorldPhysicalReadTraversal` only within its existing transaction contract; never seed its caches with caller objects. Do not accept an injected prefix, peer result, territory, dead flag, OUT, tick, revision or horizon.

Require a real `DatabaseSync` connection with main-only authority storage: reject TEMP tables/views and attached schemas before replay. Original dependency readers use unqualified names, so allowing a removed main authority to be replaced through TEMP or an attached database would bypass the same-file authority boundary. This new API precondition is enforced in the new owner/adapter; legacy readers remain unchanged. It must not replace the caller's authorizer or transaction settings. Establish an owned read transaction when absent; inside a caller transaction, leave it open and preserve its query-only state and authorizer. The physical traversal helper itself does not create that transaction. A null execution cut is an empty execution prefix only when both field-execution ownership tables are absent; partial installation and a non-null request against absent ownership fail. Observation never installs schema. When both tables exist, `scope(baseField, null)` validates their complete metadata without replaying any execution payload.

The result pins:

- original game/play/pitch/fixture/venue and profile identity;
- accepted policy Source/hash plus immutable registered-profile hash;
- field root and execution cut IDs and exact revisions;
- original physical-prefix manifest and existing archive hash conventions;
- pure rule interpretation and all original physical contact frames;
- the original accepted pitch's progress revision, contact sequence/tick, verified count and before/result timeline hashes;
- prior-ground and decisive-stop origin references: physical owner, Source ID/version, revision, snapshot hash, raw contact index and exact `BallWorldMoment`.

Origin references must resolve to actual raw boundary records, not a later observation that repeats the same field state. Each includes a discriminated raw record location, raw contact index, owner, Source ID/version/revision/hash and exact raw moment. The existing projection can merge coincident contacts while retaining an earlier incoming moment; preserve all raw origins for a decisive merged contact instead of reconstructing a raw moment from the normalized frame. The complete physical owner manifest remains available for unsupported branches. For the positive v1 category only ordinary ground/stop motion is needed; do not add a generic interpretation of capture/throw variants. Reject any positive interpretation whose causal contacts cannot be linked exactly to the authenticated raw prefix.

Historical reads authenticate the complete owner metadata/head census but replay payloads only through the specified cut. Later valid physical work does not change the old result; a corrupt historical dependency invalidates it. No call to this adapter persists a rule event, changes a physical head, opens/closes a legal window, or emits a physical/official result.

### Exact planned test files

1. `src/core/rules/BallWorldSettledFoulDeadEvidence.test.ts` (32 verified Core contract cases)
2. `src/host/world/SqliteBattedVenueLegalPolicyStore.test.ts` (37 cases with observed scaffold RED)
3. `src/host/world/BattedVenueLegalPolicyBoundary.test.ts` (separate held regression cut: unrelated Match trigger rollback, policy/physical TEMP shadows, caller transaction and WAL controls)
4. `src/host/world/BattedVenueLegalEvidenceFromSqlite.test.ts` (authored observer contract; requires the verified policy owner before runtime)
5. `src/host/world/BattedVenueOriginalContactCount.test.ts` and `BattedVenueOriginalCountFixtures.test-support.ts` (separate real three-pitch count contract and existing-owner fixture)

No existing production file must change for this first adapter. Existing fixture helpers may be reused without modifying their default bytes. If proof requires changing a legacy owner, stop and present that extra scope before implementation.

## Acceptance gates

### Core composition

- Genuine singleton ground then actual foul rolling stop before both gates yields a dead-ball interpretation at the exact stop moment.
- Every legal pre-pitch count, including two strikes, retains unresolved bunt/count consequences; no OUT, count application or official state is manufactured.
- Fair settling, ordinary airborne horizon, grounded-but-not-stopped horizon, and foul-side fielder touch remain unresolved.
- Earlier/equal unknown surface, nondefender, defender, bag, acquisition and simultaneous contact are not erased to obtain the positive case.
- An unknown surface later than the decisive stop remains in the complete evidence even when the earlier dead-ball interpretation remains derivable.
- Different elapsed moments sharing one quantized tick remain distinct; an exact coincident unknown event blocks the positive case.
- Reject missing/foreign policy version/profile/revision, extra results, invalid count, mutated contact time/state and incomplete provenance.

The authored contract now covers all four base identities both earlier than and exactly at the stop, with their complete matching surface/base companions. It also covers complete secured/interrupted acquisition records ending earlier than or exactly at the stop, retaining the candidate's own glove contact. These negative inputs are independently passed to the existing territory derivation before the new adapter is queried; they must remain valid inputs with an unresolved new interpretation, not obtain rejection merely through malformed provenance. Removing required companion evidence is tested separately as an error. A strictly earlier unsupported surface sharing the stop's quantized tick is distinct from the exact-coincidence and later-same-tick cases.

### Native ownership and storage

- Build a real original `npb-2026` fixture, accept its original model/material/geometry, execute a foul rolling stop, and prove the stop through existing physical owners before invoking the new adapter.
- Assert exact physical input archive bytes and all field/execution heads before/after policy acceptance and evidence reads; adapter observation must not advance any owner.
- Require exact game/career/fixture/venue/model/response/base/field geometry/profile bindings. Foreign Source IDs, altered SQL mirrors, hashes, snapshots, fractional revisions, unknown versions and mismatched dependency hashes reject.
- Verify reopen, callback-free historical read and idempotent policy retry; changed Source/policy content rejects.
- Prove original ground/stop Source, revision, raw contact index, unrounded elapsedSeconds and BallWorldMoment; retaining only the quantized tick is insufficient.
- Verify current and historical bounded cuts. A malformed future payload does not become past evidence; malformed future owner metadata still rejects. Later source appends do not mutate a saved historical interpretation.
- Test policy insert triggers and WAL mutations of policy/profile/geometry/physical dependencies; acceptance must roll back rather than publish a mixed proof.
- Assert no writes to physical actions/heads, `actual_live_play_admissions`, first-base rule actions, calls, PlayEnd, fences, closures, count, score, bases or roster.
- Re-run existing territory/first-base/PlayEnd/fair-timeline rejection tests unchanged. New dead evidence must not make the old grounded-fair pipeline accept a foul play.

## Ordered work and stopping conditions

1. Review the bounded category and interface, including its evidence-only limit and deferred count consequences.
2. Once the runtime hold is explicitly lifted, run the new Core contract and record the actual failure against the fixed source. A missing-module failure alone is not a completed behavioral RED; after adding only the minimal interface scaffold, observe the positive and rejection assertions fail for their intended reasons before implementing behavior.
3. Prove the new Native foul fixture with existing owners only. If it cannot be produced without invented calibration or weakened ownership, stop; the pure Core fixture does not satisfy Native acceptance.
4. Implement the pure Core adapter only after that contract review/RED, then the immutable policy owner and read-only Native adapter with their observed RED→GREEN tests.
5. Run focused Core, Native/WAL, type and unchanged v1 guards at the final SHA. Independent review must inspect policy laundering, exact-time contact origins, read-only behavior and archived compatibility.
6. Record results honestly and return for integration; no merge/deploy/design/runtime/official-consumption extension is part of this contract.

### First fixed-source RED controller

The prepared controller selects only `BallWorldSettledFoulDeadEvidence.test.ts` through an explicit standalone Vitest config and the pinned Node26 runtime. It runs only after the runtime hold is released. Admission requires exclusive nonblocking acquisition of the native, auxiliary-native and light-check locks, at least 7 GiB available memory, 192 MiB requested oldspace / 288 MiB observed heap, a 384 MiB process-group RSS cap, and a 30-second wall cap. It stops its own child process group if available memory falls below 6 GiB. It must not touch another verification process.

Pin the commit, source tree, tracked/source manifests, test file, controller, config, probe, runtime and dependency root. Record before/after hashes, the exact command, worker runtime telemetry and a terminal receipt. No catalog compiler, npm hook, typecheck, Native test or SQLite owner is invoked by this initial Core gate.

The observed first result at `a4c52e32f2efa15c3acb58e6b446f190d79830f5` was one selected failed suite caused specifically by the absent `BallWorldSettledFoulDeadEvidence` module, with zero collected/executed test cases. Its source/control manifests were unchanged, the actual heap was 288 MiB, resource evidence was valid and the process group was reaped. This establishes only an expected import failure, not behavioral RED.

The second fixed-source gate used the typed throwing scaffold at `0579b6605be47af60f957e86ba3bf8b205472845` and the unchanged test file. It observed 32 collected cases: 21 failed specifically at `SETTLED_FOUL_DEAD_EVIDENCE_NOT_IMPLEMENTED`, and 11 rejection-only cases passed because the scaffold always throws. There were no skipped cases or fixture/other errors. The source/control manifests were unchanged, actual heap was 288 MiB, peak process-group RSS was 257,844 KiB, and the process group was reaped after 1.157 seconds. Receipt SHA256: `c699d105af8d10a985cafb6dc915be526851cf694a17ec6fb3e9a36363c19151`.

Those 11 scaffold passes did not prove validation. The implementation subsequently passed all 32 cases plus 23 existing territory/foul/count cases, and full compiler, at `71bb6da`. Any existing-Core fixture/setup error, unexpected result, resource stop, source drift, wrong selection, runtime mismatch or incomplete receipt remains separate from a successful contract result.

## User-owned policy decisions

No new baseball rule value or stadium semantic is required for the proposed evidence-only settled-foul category. An explicit accepted policy Source is still required at use time; the adapter must not silently synthesize it from venue naming or a known RuleProfile.

Future wall/roof/stands/field-exit/interference support needs the actual venue's accepted legal treatment, a complete boundary/contact model, applicable RuleProfile semantics, and any required actor intent/eligibility evidence. Those are genuinely missing inputs, not values to choose in this implementation. Bunt/count resolution also needs an owned batter-intent fact. Applying dead ball to live action, umpire/review and PlayEnd/closure are subsequent versioned integrations with their own canonical-consumption and watermark proofs.


### Native policy connection-boundary regression cuts

The initial implementation at `365e0b8` remains unverified. The separately frozen `6c179bd` five-case contract requires rollback of an unrelated Match write from an insert trigger and rejection of both canonical-policy and physical-field TEMP shadows; its transaction/authorizer and WAL-snapshot controls are expected to pass. The later seven-case regression receipt was observed before correction; the earlier five-case preparation remains unrun and superseded.

The subsequent test-only cut adds two missing-main response-model replacement cases, one using TEMP and one using an attached file. Each first proves that the existing unqualified response reader accepts the exact copied original rows despite the absent main table. Only then does it expect the new policy evidence reader to reject that connection. This keeps an already-rejecting legacy path or fixture error distinct from an exposed new API failure. Expected pre-fix outcomes are seven total cases: five missing-boundary assertion failures and two passing controls. The tests restore the original main schema and rows after each case.


The seven-case `ca8775d` boundary RED was observed on 2026-10-05 at 11:29:14 UTC: five intended missing-rejection assertion failures, two transaction/WAL controls passed, no skips or fixture errors, and unchanged source/control manifests. Receipt SHA256: `c5c1521252ade970014e05ce1c1682f4ef90b4c923b8837695114ae2390e14b6`.

The correction changes only the new policy owner. It checks for main-only storage inside the existing physical read traversal, qualifies its own schema/row/field-join queries with `main`, and requires the transaction's `total_changes()` to advance by exactly one for the policy insert both before and after final revalidation. An unrelated trigger write therefore aborts and rolls back the whole acceptance. These corrections passed all 37 policy and seven boundary cases plus full compiler at `fa159f3`; the tests remained unchanged. Source, controls and runtime identities were unchanged, with no skipped cases and all child processes reaped. Policy receipt SHA256: `2947de1ddcebac586697c3ba205f3386fac59703981a28170072d3e72e7799c0`. Compiler receipt SHA256: `3f89d760243b4817e60ebc56173c060d5b8fba54c7bd82a1096f4176a4f55370`.


### Original three-pitch count fixture

The count fixture executes two original taken pitches through `SqlitePhysicalPitchProgressStore`, requires their actual result to be an active two-strike timeline, then accepts a third original swing before execution. It uses the existing continuous-pitch fixture's bodies, release profile, fatigue response and calibration. A read-only physical preview samples that third trajectory at the existing fixture's 590,000-tick contact offset and places the original stationary bat segment there before persistence. No count event or saved physical state is injected.

The independent count gate must first prove that the frozen Match count remains zero strikes while both the actual third-pitch before timeline and batted-ball-pending result have two strikes. The positive count assertion then expects the original progress revision, BatBallContact sequence/tick and timeline hashes. Four inconsistent copies must reject. At the throwing scaffold, the intended result is one explicit count-scaffold failure and four rejection-only passes. A pitch/fixture/setup error is not behavioral RED. The verified immutable policy owner is now integrated into the observation scaffold cut. The original-count and observation scaffold RED gates have been observed; their successful implementations remain unverified. The observation contract has 20 cases; at its throwing scaffold the expected result is six positive-path failures and 14 rejection-only passes, which are not validation proof.


### Original count and observation behavioral RED

The `a09ed26` original-count gate executed two genuine taken strikes followed by an accepted third-pitch contact. The frozen Match retained zero strikes while the actual before/contact/result timeline carried two. It observed five cases: one intended count-scaffold failure and four rejection-only passes, no skips or fixture errors, and unchanged source/control/runtime identities. Receipt SHA256: `6546702eb730da7df8632b2d220e7e1684c7bd09ce1db8444b02b7354f7cdd86`.

The `44b79b9` observation gate used the verified immutable policy owner and genuine foul fixture. It observed 20 cases: six intended observation-scaffold failures and 14 rejection-only passes, no skips or fixture errors, and unchanged source/control/runtime identities. Receipt SHA256: `97e4aaa69dcdd9ffc9bbfa0c49942cb7d1763af1521ba143082dda60c14723f3`. Neither set of rejection-only passes establishes validation.

The implementation candidate reads an explicit same-connection bounded field/execution prefix, authenticates the exact policy anchor and original dependency hashes, derives count from the original pitch timeline, then composes the verified Core rules. It retains the full physical contact frames and owner manifest, and links the decisive ground/stop to actual producer records with their exact raw moments. Observation/plan repetitions are excluded from raw origin claims. Missing physical origins reject instead of certifying the result. No existing producer, first-base guard, live closure or official consumer changes. The original 20 observation and five count cases remain unchanged for the first GREEN.
