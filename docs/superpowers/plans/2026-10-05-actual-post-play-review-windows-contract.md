# Actual Post-Play Review Windows Implementation Plan

**Status:** The 30 API-absence RED cases at `9d94717c997576e8a088c080f156693fb09d2625` were followed by 30/30 pure GREEN at `67b4d4c9d94ee67d553c28cbec9c30bd919cd72f`. The assigned-official addition passed all 39 combined pure cases at `f5dd20c82fed96aa9c96a13bb6c3d6173c3a9f8e`; its initial compiler errors were subsequently corrected by separating the action discriminants. The Native journal at `5abc35d49c5ab7aa861931a2a2d37a41991f746f` passed 15 focused Native cases, then the full compiler and 202 cases across 13 pure/Native/Core files, with no skipped cases, unchanged Source/control hashes and reaped processes. Physical-domain readers remain mocked in the Native fixture. The strict closure pin and current optimized read-pair integration at `93c1651317f1cb7b3d33f52f09dbf8b7ec058bff` then passed the full compiler and 256 cases across 18 files. Unmocked physical-to-review application and a review-domain Manager selection owner remain pending. The final stack at `40c39fee3ef0c4bfd385c1095c3d0578e85099c5` passed the full compiler and the same 256 cases; the publication copy preserves its source tree. See the [qualification record](../../verification/2026-10-05-actual-post-play-review-journal-and-closure.md).

The assigned-official RED controller receipt at `b5b399db7ab58d6d964c152ef549c05a820969ae` remains failed: it expected full error strings that Vitest truncated. A separate exact assertion/stack-location evaluation verified its eight intended rejections and one passing regression without replacing that receipt or rerunning the tests. Native API-absence RED at `1e64835dcf80fb5822aac2c6352ed7abe249683b` verified all 15 intended failures after genuine focused control/Club/WAL fixture setup.

**Goal:** Connect accepted post-play review/challenge actions to the existing original-call ledger and official closure without changing physical history or inventing competition policy.

**Architecture:** Keep `actual_live_adjudications` as the immutable v1 seed. Add one Native review-session owner with an append-only accepted-event journal, replaying the existing Core window/review APIs over that seed. The existing closure owner consumes an optional exact session revision/hash; plays without a review session keep their v1 path and serialized archives unchanged.

**Tech Stack:** Existing TypeScript, Vitest, `node:sqlite`, same-connection Native evidence readers, WAL/CAS transactions. No dependency or workflow change.

**Spec:** `docs/game-design/05-world-first-live-ball-architecture.md` §§2.6/8; `06-world-first-runtime-contracts.md` §§9.5/10.4; `07-world-first-adjudication-contracts.md` §§2–8; `docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md` §5, item 4.

## Global constraints

- Source inspected: `2aca40945c79621804606d7dadf3793c49e40ec2`, whose only difference from coordinator integration `8fe019e7db9264d9415f5df3d6cb0c378e7d6420` is the nonvisual continuation status document.
- Authoritative design: Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`; Realism `4f0a60a3818926327b6bf5877ab3dec456a76530`.
- No UI, Presentation, new visual design, autonomous manager policy, invented calibration, physical reset, merge, deploy, home-PC CI, or archive rewrite.
- Physical PlayEnd and the immutable original timeline are already owned inputs. This owner cannot produce either.
- Missing policy remains unknown/pending. Enabled review/challenge becomes owned open work, never silently unavailable, declined, or expired.
- The observed RED is API absence evidence, not a successful behavioral or Native verification. Preserve this distinction in subsequent validation records.

## Source findings

1. `src/core/adjudication/PlayAdjudicationLedger.ts` already owns revisioned snapshots, `OwnedLiveCallImported`, `OfficialStateWindowOpened/Closed`, review decisions, stale-evidence rejection, and official closure. `recordReviewDecision` intentionally permits a low-level caller replacement ruling; a Native production adapter must not expose that parameter as accepted input.
2. `src/core/adjudication/OfficialWindowPolicy.ts` already owns profile-gated opening, timing, and boundary advancement. Expiration requires an explicit positive duration and an event strictly after the deadline. Exact-deadline admission is `simultaneous_unresolved`. A next-play fence cannot close an unexpired review/challenge. No additional timer law is needed.
3. `src/host/world/ActualLiveAdjudication.ts` records snapshots and the original call, but never opens a window. It returns `official_window_owner_unavailable:review/challenge` for enabled policies. `on_field_call_stale` is a seed finding, not a reason to replace or rebind that call.
4. `src/host/world/ActualLiveAdjudicationFromSqlite.ts` already authenticates the sealed physical end, final rule applicability, original field prefix, original umpire call and all import references. It keeps both the original call's rule snapshot and a later final snapshot. Reuse this reader; do not recreate the physical graph.
5. `src/host/world/SqliteActualFirstBaseUmpireStore.ts` provides `readAvailableCall` and `importReferences`. `OwnedLiveCallImportProvenance` retains game/play/pitch, clock, original called/available moments, import moment, call/perception/policy/rule owners, and optional reception. Availability is not manager reception; the new owner must not manufacture a reception event.
6. `src/host/world/SqliteActualLiveAdjudicationStore.ts` allows exactly one immutable seed for the physical end and `(gameId, playId)`. Modifying its derived ledger would invalidate persisted `snapshot_json/hash`; repeatedly accepting new seed IDs is not a continuation strategy.
7. `src/host/world/ActualLivePlayClosureEvidenceFromSqlite.ts` currently reads only the seed, checks `official_ready`, then calls `closeOfficialPlay`. This is the narrow consumer seam for a separately owned current continuation. Its downstream application/scoring/reset logic can be reused.
8. `src/core/rules/RuleProfile.ts` registers `npb-2026` with appeal availability only. Review/challenge=false in `ActualLiveOfficialArtifact.test-support.ts` is an explicitly accepted fixture supplement, not a production default. `actualLiveAdjudicationProfile` already refuses a supplement that contradicts registered fields.
9. `src/core/world/control/ControlledDecision.ts` and `DecisionEvidence.ts` already validate selected legal actions and distinguish human overrides from manager decisions. `SqliteWorldControlStore.ts` owns current control/world revisions. There is no existing adopted post-play challenge/review intent owner; the pitch command's `challenge` value is pitch aggression and must not be reused.

## Chosen bounded contract

### 1. Immutable session and accepted provenance

Add `AcceptedActualPostPlayReviewSession` with exact `sourceId/sourceVersion`, seed `adjudicationSourceId/snapshotHash`, explicit accepted official policy supplement (or null), and a versioned session policy Source. The session policy explicitly selects `openingTrigger: physical_play_end`, `clock: post_play_discrete_tick_v1`, `expiryScope: request_admission`, one accepted scheduler identity, eligible request/decline actors, assigned review officials, and per-window request entitlement. A received command's assertion alone is not entitlement.

The Native owner reconstructs the seed through `actualLiveAdjudicationEvidenceFromSqlite(db).read(...)`, then obtains the actual opening from `actualFirstBaseClosedEvidenceFromSqlite(db).read(seed.source.physicalEndSourceId)`. That existing callable owner (`SqliteActualFirstBasePlayEndStore.ts:48`) authenticates the archived physical end and its exact seal. Its `exactEnd` and `playEnd.tick`, plus the unchanged original call import clock, supply the opening moment/epoch/scale. The accepted session Source contains **no opening timestamp**, caller window result, watermark, or physical end payload. An absent trigger remains pending; this first adapter does not pretend to support a competition whose opening trigger is an earlier call/reception.

There is no existing post-play clock owner to borrow: `actualLivePlayQueueEvidenceFromSqlite` explicitly reports `represented_sources_only`, `event_generation_coverage_pending`, and `closureFence: not_installed` (lines 124–126). `SqliteWorldControlStore` owns control/decision revisions, not simulation ticks. Neither can certify later post-play queue progress.

The new journal therefore owns a deliberately bounded **post-play event-order cursor**, not a general clock service:

- At initialization, cursor tick is the authenticated physical `playEnd.tick`, offset is zero, and original `originTick/ticksPerSecond` plus exact end reference are pinned. The original fractional physical end remains immutable; subsequent journal records claim integer adjudication ticks only.
- Only an accepted `advance_tick` event from the session's assigned scheduler can advance it, by exactly **one** tick. Source fields cannot supply a timestamp, elapsed duration, delta, target tick or settled-through watermark. Safe-integer overflow rejects the entire event.
- `acceptEvent(sourceId)` resolves an immutable accepted Source through the authority callback. In one Native transaction it validates Source/scheduler or intent authority, compares parent/revision, stamps a command at the current cursor, reduces it, and appends the event/head. A scheduler event derives the next cursor tick before applying its boundary. A request cannot masquerade as a scheduler event.
- One serial ingress is the complete membership of this bounded journal. The owner admits and reduces commands synchronously; it does not claim that outside or in-flight commands were already received. Later commands are stamped at the then-current cursor and cannot be backdated. Native sequence can order processing within a tick, but cannot resolve deadline equality.
- Clock advancement never discards a timely accepted request or a same-deadline ambiguity. `next_play_fence` runs at the current cursor and never advances time. This cursor neither moves physical actors nor infers elapsed fatigue/recovery, communication delivery, new perception, or whole-game event coverage.

This implementation choice is consistent with the separate monotonic post-play ledger required by adjudication §4.1, same-tick information limits in §6.4, and runtime §11's exact canonical tick/explicit sequence and wall-clock prohibition. Those contracts permit this event representation; they do not prescribe a one-tick scheduler or supply competition timing. The explicit accepted session policy selects this bounded adapter. No global watermark is emitted.

If the seed already has an explicit policy Source, the continuation must preserve it exactly. If the seed left policy unspecified, an explicit continuation supplement may fill those unspecified capabilities through `actualLiveAdjudicationProfile`. Registered profile fields cannot be changed. Every enabled kind requires its own opening/entitlement evidence before readiness; a missing opening never means the kind is irrelevant.

The session creates one window per accepted review/challenge opportunity through `openRuleProfileOfficialStateWindow`. Appeal applicability remains the existing proved `original_empty_bases_grounded_first_base_only` case; no new appeal owner is introduced.

Pure initialization may preview a pending projection when the official supplement, opening policy or an enabled opportunity's entitlement is absent. Native enrollment must not persist that incomplete Source as an immutable session or reserve its unique seed/play identity. `acceptSession` returns an explicit `intake_pending` result with the missing-input reasons and no session, event or head row. Once complete accepted inputs are supplied, a complete Source can be enrolled for that original seed/play. This does not mutate a previously persisted policy or session, and a pending preview is never a durable receipt or closure reference. Tests must first observe zero rows after incomplete intake, then successful complete enrollment for the same seed/play.

### 2. Accepted journal events

Add `AcceptedActualPostPlayReviewEvent` with `sourceId/sourceVersion`, session ID, exact parent event ID/hash, expected Native revision, and one of the following actions. It has no caller-supplied recorded moment; the journal stamps it atomically:

- `request`: accepted human/manager intent, exact original `callId`, target `windowId`, immutable legal-action/entitlement Source, and requester identity. Reuse `selectControlledDecision` for human/manager attribution and verify its control, club, appointment, opportunity and action bindings from owned/accepted evidence. This does not generate a manager choice. Native stores the executed-event IDs for existing attribution consumers.
- `official_request`: distinct `actual_post_play_review_official_intent_v1` Source with the same session/game/play/pitch/call/window/entitlement scope, a named `officialId`, and literal `action: request`. The official must appear in both the opportunity's explicit requester list and its assigned-reviewer list. No control, manager, human-origin, timestamp or scheduler fields are accepted. The adopted request has null controlled-decision attribution and still requires a later explicit review decision.
- `decline`: explicit accepted controlled actor decision bound to one still-unrequested window and its entitlement. No absence-of-input or elapsed-time inference; this slice adds no separate official-decline channel.
- `decision`: assigned review official, initiating accepted request Source, exact original `callId`, latest snapshot ID/revision, and `confirmed | stands | overturned`. There is no accepted `replacementRuling`, occupancy, score, out total, physical event, or replacement call field.
- `advance_tick`: accepted event from the session scheduler, deriving exactly the next journal tick and using the existing profile expiration API only where no accepted request/ambiguity would be discarded.
- `next_play_fence`: accepted event from that scheduler, evaluating the existing profile fence at the current cursor without advancing it or applying MatchState.

Native revision counts accepted events, including a boundary that changes no Core event. It is distinct from Core ledger revision and original physical evidence revision. Store all three where relevant; never alias them.

Requests use `evaluateRuleProfileOfficialWindowTiming`. Exact-deadline requests stay explicitly pending; do not order them by insertion ID or resolve that ambiguity merely by advancing time. A request before the deadline remains an active review after the request deadline. The accepted session policy must explicitly state that a deadline applies to **request admission**. While a timely request or an admission ambiguity is active, do not call blanket window expiration/next-play advancement that could discard it. Its window remains open until an authorized resolution; unrequested windows can be handled after that resolution or individually declined. No finite duration is synthesized when none was supplied. The initial adapter has no new same-tick tie-breaking policy, so ambiguous admission stays pending.

`confirmed` and `stands` retain the original call through `recordReviewDecision`. An `overturned` decision in this initial adapter is explicitly bound to the latest authenticated resolved correct-rule snapshot and uses only that snapshot's ruling as its replacement. This is a bounded correct-rule-backed overturn path, not general review perception or every possible reviewer judgment. It never chooses a review decision automatically. If that snapshot is unresolved, or broader runner placement is required, keep the request/window pending with an explicit unsupported-evidence/placement reason. Do not invent a ruling. A supplied reviewed snapshot basis must match the Native latest snapshot; never silently upgrade it.

A completed decision atomically appends the Core review event and closes its initiating window as `resolved`. Other open windows remain open. `decline` closes only its target as `declined`. All original snapshots, the original import event (including original called/available moments), and physical references remain byte-equivalent.

### 3. Readiness and closure handoff

Return a `DurableActualPostPlayReview` with accepted Source chain, seed/call/rule/policy references, Native revision/head hash, Core ledger, and explicit pending reasons. It is `official_ready` only if all configured applicable windows are accounted for and closed, no active or ambiguous request remains, and the resulting latest call/review basis can satisfy Core closure.

Recompute readiness from the current owned ledger. Do not merely delete the seed's `owner_unavailable` or `on_field_call_stale` strings. A valid review over the latest snapshot can resolve staleness while preserving the original call; expiration or decline cannot resolve it. Unknown policy, missing call, unsupported timeline, and unresolved applicability remain blockers.

Add an optional `postPlayReview` reference to `AcceptedActualLivePlayClosure`: `{ sourceId, revision, snapshotHash }`. For plays without a review session, its absence preserves the exact v1 input/output serialization and behavior. When present, read and authenticate that exact session revision, ensure it belongs to the named seed, and use its ledger/readiness. Carry the reference into the new closure proposal only on this path. The existing seed reference remains a seed reference; do not overload its hash to mean the session hash.

Current closure enqueue rejects a stale session revision/head and reserves that session against new accepted events. The existing queued closure row and its optional pin provide the reservation; no new close authority is minted. Current write/apply hooks recheck it in the same transaction. Historical reads replay their exact referenced prefix and do not import future actions. Once queued/applied, an event writer cannot reopen the play. v1 closure must also reject any contradictory current review owner for the same seed/play instead of bypassing it by omitting the optional reference.

### 4. Persistence

Use additive `actual_post_play_review_sessions`, `actual_post_play_review_events`, and `actual_post_play_review_heads` tables. Session is unique by seed and `(gameId, playId)`; events are unique by Source and `(sessionId, revision)`. Head CAS includes revision, parent Source and hash. Stored Source and derived snapshot hashes are evidence checks, not replacements for same-connection reconstruction of their owners.

Read identity claims from columns and raw Source/snapshot mirrors, including escaped JSON paths through existing metadata helpers. Pin the complete relevant prior raw rowset across acceptance preflight, BEGIN IMMEDIATE, and post-insert rederivation. Reject hidden aliases, parent deletion/rewrite, changed accepted callback, wrong play/call/policy, late dependency changes and an existing closure reservation. A failed write rolls back event, head and all affected rows. Identical retries return the original receipt without advancing either revision.

## File scope and implementation sequence

### Task 1: Pure accepted-event adapter

**Create:** `src/host/world/ActualPostPlayReviewSource.ts`, `ActualPostPlayReview.ts`, and their `.test.ts` files. Add compatibility-preserving re-exports to the existing `ActualLiveAdjudicationSource.ts` and `ActualLiveAdjudication.ts` entry modules. Tests currently inspect those existing namespaces and assert missing capabilities explicitly, so the pre-implementation RED can be an assertion rather than a missing-module collection failure.

**Interfaces:** `actualPostPlayReviewSessionInput(raw, sourceId)`, `actualPostPlayReviewEventInput(raw, sourceId)`, and `actualPostPlayReviewIntentInput(raw, sourceId)` parse exact inert accepted fields. `initializeActualPostPlayReview(input)` consumes a reconstructed seed/physical-end proof and accepted session policy. `advanceActualPostPlayReview(input)` consumes a reconstructed predecessor, authenticated accepted event and optional accepted intent evidence. Both return the revisioned projection described above. Pure inputs are not proof; production access remains through Native.

The concrete test-only interface is in `ActualPostPlayReviewContract.test-support.ts`: initializer input `{ source, seed }`; reducer input `{ previous, source, intent? }`; output has Native `revision/headSourceId/headHash`, original-clock `cursor`, Core `ledger`, accepted `events/requests`, and readiness. `ActualPostPlayReviewSource.test.ts` contains 8 parser cases; `ActualPostPlayReview.test.ts` contains 22 adapter cases, including authenticated seed identity and exact-end clock binding. They use real existing Core seed/ledger functions with no module mocks or production stubs. The first run reached the deliberately missing additive export assertions in all 30 cases; behavioral assertions await execution against the candidate.

- [x] Write the source/adapter contract tests below before any production adapter.
- [x] Run the focused test-only contract and save its actual RED receipt before production changes.
- [ ] Implement only the adapter using existing `openRuleProfileOfficialStateWindow`, `evaluateRuleProfileOfficialWindowTiming`, `advanceRuleProfileOfficialWindows`, `closeOfficialStateWindow`, `recordReviewDecision`, and ledger state readers.
- [ ] Run focused GREEN and Core regression tests; commit the bounded adapter.

### Task 2: Native accepted-source journal

**Create:** `src/host/world/ActualPostPlayReviewFromSqlite.ts`, `ActualPostPlayReviewMetadata.ts`, `SqliteActualPostPlayReviewStore.ts`, plus Native/WAL tests.

**Interfaces:** `actualPostPlayReviewEvidenceFromSqlite(db)` supplies `readSession(sourceId)`, `readEvent(sourceId)`, `readAt(sessionSourceId, revision)`, `readCurrent(sessionSourceId)`. `openSqliteActualPostPlayReviewStore(path, authority?)` supplies `acceptSession(sourceId)`, `acceptEvent(sourceId)`, those reads, and `close()`. Authority reads accepted session/event/intent Sources; public write methods do not accept a caller ledger or ruling.

- [ ] Write authentic disk/WAL acceptance, bounded replay, malformed identity, stale parent, duplicate, callback mutation and late-trigger tests; observe RED before implementation.
- [ ] Prove incomplete session intake writes no session/event/head rows and leaves the same seed/play available for later complete enrollment; never persist an immutable null-policy reservation.
- [ ] Implement same-connection rederivation, immutable event rows and transactional head CAS. Reuse original end/call/policy/control evidence owners.
- [ ] Prove complete rollback, close-all/reopen, deterministic retry and historical prefix reads; commit only after focused GREEN.

### Task 3: Existing closure consumer

**Modify:** `src/host/world/ActualLivePlayClosureSource.ts`, `ActualLivePlayClosureEvidenceFromSqlite.ts`, and `SqliteActualLivePlayClosureStore.ts`; add focused source/closure tests. Add only a reusable same-connection control reader if the existing control/club sources require it; do not replace the current stores.

- [ ] Write tests for exact continuation pin, omission bypass, late event versus enqueue reservation, original v1 bytes and already-applied history; observe RED.
- [ ] Add optional reference selection and transaction guards; retain existing scoring, world reset, official application and actual-role workload behavior.
- [ ] Run focused old/new closure tests and commit.

### Task 4: Original-chain proof and review

**Create:** `src/host/world/ActualPostPlayReviewArtifact.test-support.ts` and a bounded test entry, reusing the already accepted original physical-end artifact and existing fixture style.

- [ ] On a separate writable copy of the accepted artifact, create an explicit fixture policy with review/challenge enabled; preserve the source DB and original physical table hashes.
- [ ] Demonstrate pending open windows, original-call identity, accepted timely intent, review/decline resolution, exact closure pin, exactly-once official application, fault rollback, and close-all/reopen.
- [ ] Fresh source review, focused Core/Native regressions, typecheck, then the coordinator-selected frozen aggregate gate. Record exact Source/terminal status; do not relabel fixture coverage as production calibration or whole-plan completion.

## Test-first contract cases

These are concrete cases to encode after contract review, before production code. Fixture tick values below are synthetic and do not configure NPB.

1. **Owned enabled window:** Seed has original call tick 2010, import/physical end 4010, unresolved snapshot revision 4, and explicitly enabled review. An explicit physical-end trigger derives opening 4010 from the owned end and produces one open Core review window and `official_pending`; imported call tick remains 2010; no `owner_unavailable:review` remains on the new owned projection. The v1 seed JSON/hash is unchanged.
2. **No policy fallback:** A null policy seed/session remains `official_window_policy_unconfigured:review/challenge`; no windows, expiry, review decision or ready state is fabricated. Explicit false is preserved as false; a conflicting supplement is rejected.
3. **No missing-opening shortcut:** Review availability true with no supported accepted trigger remains `opening_event_unowned`; caller opening timestamps and future boundary values are rejected. This owner supports only the explicitly selected physical-end trigger.
4. **Original call binding:** Event for another call/game/play/pitch or a rewritten original `basisSnapshotId/revision` is rejected. Original called/available/imported moments and references survive every transition unchanged.
5. **Accepted request provenance:** Wrong club/controller/manager appointment, stale control/world/Native revision, unknown action, missing entitlement, duplicate intent consumption, or forged manager-origin label fails. A valid human override records its actual executed event IDs and produces no manager-self-chosen learning evidence.
6. **Deadline equality:** Opening 4010 with explicit `expiresAfterTicks: 3` accepts request 4012 as timely; request 4013 remains `simultaneous_unresolved`; request 4014 is expired. Three scheduler tick events reach 4013 without expiry; a fourth can expire an unrequested window but cannot erase an already recorded ambiguous request. No event accepts 4013 or 4014 as a caller timestamp.
7. **Active review survives deadline:** Request at 4012 remains pending when the journal scheduler reaches 4014 or a next-play command arrives. A decision at 4015 may resolve it. No generic expiration consumes an active request. No-duration policy remains open after later scheduler events. Wrong-scheduler identity, caller tick/delta/watermark fields and integer overflow are rejected without changing the cursor.
8. **Decline is explicit:** A permitted decline closes only its unrequested target; no-input, a horizon, and a next-play command are not decline. Another enabled opportunity still prevents closure.
9. **Truth versus decision:** `stands` over an unresolved latest snapshot retains the original call. `overturned` over a resolved SAFE snapshot derives the existing snapshot's first-base occupant and outs; supplied replacement fields are rejected. Unresolved overturn stays pending without adding a fake correct-rule snapshot or closing the window.
10. **Staleness:** Seed original call binds revision 4 and final snapshot is revision 5. A review explicitly bound to revision 5 can establish a current ruling while retaining the original call; a revision-4 decision fails. Expiry/decline alone leaves the stale-call blocker.
11. **Closure race:** Closure pinned to revision N cannot enqueue when current head is N+1. Once exact N is queued, event N+1 cannot be accepted. Omitting the continuation reference cannot close via the seed. An insert-trigger mutation rolls back all rows, with a witness proving the guarded INSERT actually occurred.
12. **Archive custody:** v1 seed and closure fixtures replay byte-for-byte; reads of accepted prefix N remain valid after later journal N+1 without consuming its domain payload. Corrupt parent hash, missing prior row, duplicate/escaped Source mirror, changed policy, and coherent prior-row rewrite fail. Identical accept/close/reopen retries are exactly once.

## Review focus

- A configured opportunity can disappear unless every enabled kind is accounted for (cases 1–3).
- Call import time can accidentally replace original call/availability time (case 4).
- A request deadline can accidentally become a review-completion deadline (cases 6–7).
- Arbitrary replacement rulings or stale bases can enter through a valid-looking accepted event (cases 9–10).
- A newer event can race a closure or retroactively invalidate an older archive (cases 11–12).

## Future validation commands

Run focused Vitest on the new Source/adapter tests and existing `OfficialWindowPolicy`, `PlayAdjudicationLedger`, `LiveCallAdjudicationImport`, `UnresolvedAdjudication`, and `ActualLiveAdjudication` tests; then the new Native/WAL/closure tests on a real disk file with one worker and the project's resource guard. Run `npm run typecheck` and the coordinator-selected final aggregate verification on the frozen reviewed Source. Save before/after Source manifests and terminal exit receipts. The original 30-case pure GREEN has run. The assigned-official candidate, combined compiler/adjacent regressions, and Native validation have not run.

## Required policy inputs and remaining boundaries

Implementation can proceed against explicit accepted fixture inputs. It does not require inventing production calibration or asking the user to choose fixture numbers. Production adoption still needs an explicit physical-end opening-trigger policy for this adapter, accepted scheduler identity, review/challenge availability, eligible requesters/review officials, per-opportunity entitlement and any request-expiry duration. The first adapter accepts those values and leaves missing values pending; it neither decides challenge quotas across games nor decrements a guessed quota.

Pre-PlayEnd review-window import, automated manager selection, autonomous review perception/decision generation, broader runner placement, general appeals/interference, and extraordinary reopening are separate owners. This plan connects accepted post-play actions for the existing bounded first-base scope and does not claim those additional capabilities.
