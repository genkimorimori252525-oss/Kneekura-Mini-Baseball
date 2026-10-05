# Actual Post-Play Review Native Adoption Contract

This continues the [pure review-window contract](2026-10-05-actual-post-play-review-windows-contract.md). The Native journal candidate at `5abc35d49c5ab7aa861931a2a2d37a41991f746f` passed all 15 focused Native cases, then the full compiler and 202 cases across 13 pure/Native/Core files. Its strict closure pin and current optimized read-pair integration at `93c1651317f1cb7b3d33f52f09dbf8b7ec058bff` passed the full compiler and all 256 cases across 18 files, including the unchanged paired-read/traversal regressions. Source/control hashes were unchanged and the processes were reaped. The focused tests mock physical-domain readers; these results do not certify the unmocked physical chain or actual reviewed official application. The final stack at `40c39fee3ef0c4bfd385c1095c3d0578e85099c5` then passed the full compiler and the same 256 cases. The publication copy retains its exact source tree and all sensory documentation through `a155d1f4`; see the [qualification record](../../verification/2026-10-05-actual-post-play-review-journal-and-closure.md).

## Owners and first adoption

`openSqliteActualPostPlayReviewStore(path, authority)` is the only writer. Authority callbacks return immutable accepted session/event/intent Sources; public write methods accept Source IDs. The store opens real WAL SQLite and reconstructs dependencies through one connection inside the read/write transaction.

- Seed: `actualLiveAdjudicationEvidenceFromSqlite(db).read(...)`; bind the exact stored seed ID/hash, original call, policy and ledger.
- Physical end: `actualFirstBaseClosedEvidenceFromSqlite(db).read(...)` and `reference(...)`; require the persisted end and seal, never a derivable proposal.
- Original game/Club scope: read the end's original base field through `battedWorldFieldEvidenceFromSqlite(db)`. Its physical pitch frame owns the career, competition edition, fixture event, game day, and original batter/defender Club/side bindings. Check the fixture and exactly one matching game in `world_season_heads.schedule_json`; each HOME/AWAY binding must match that side's Club. An unrelated Club in the same career is insufficient.
- Human authority at first adoption: reuse `createHumanControlState`, `selectControlledDecision`, `readState` from Club schemas, and `getCurrentClubManager`. Read `world_control_heads` plus its revision-event extent on this connection, following the existing `SqliteWorldControlStore` validation. Read the matching `world_club_heads` and validate its canonical state/revision. The accepted control and opportunity revisions, controlled Club, controller, manager/appointment, context and legal action must match these owned facts. A caller snapshot or matching controller name alone is insufficient.
- Assigned official and scheduler authority: bind to their exact accepted session policy and the original fixture/Club scope. An official request requires both explicit requester entitlement and assigned reviewer membership; its controlled attribution remains null. A scheduler action cannot be supplied as a human request.
- Manager authority: the available persisted selection owner is ROSTER-specific. It cannot supply a review-domain selection. Until an actual matching review-domain selection trace owner exists, Manager attempts return explicit `intent_pending: manager_review_selection_unavailable`, with no accepted event, head increment or request. Never borrow a ROSTER trace or turn caller `traceId` into executed Manager evidence.

First adoption byte-pins the accepted Source callback results, original scope and relevant current control/Club rows before BEGIN IMMEDIATE, inside it, and after the write. Pin the complete relevant prior journal rowset too. Late local/peer changes invalidate adoption; failures roll back the complete transaction.

## Intake, records and replay

Public API:

- `acceptSession(sourceId)` returns `{ kind: 'intake_pending', sourceId, pendingReasons }` or `{ kind: 'accepted', value }`
- `acceptEvent(sourceId)` returns `{ kind: 'intent_pending', sourceId, reason }` for genuinely absent required Manager selection, or `{ kind: 'accepted', value }`
- `readSession(sourceId)` reads revision zero; `readCurrent(sessionSourceId)` reads its exact current head; `readAt(sessionSourceId, revision)` reconstructs that bounded prefix; `readEvent(sourceId)` reads its adoption receipt; missing records return null
- `close()` closes the connection; repeated identical accepted Sources are exactly once

Use additive session/event/head tables. The session is unique for the original seed and `(gameId, playId)`. An event owns its exact predecessor Source/hash, Native revision, stamped tick, accepted intent and immutable admission evidence. The event/head CAS is atomic. The head cannot advance without the event, and events cannot branch, skip a revision, or reuse a consumed intent.

Missing official policy, opening policy or an enabled entitlement is incomplete enrollment. It creates **zero** session/event/head rows and **no** unique seed/play reservation. A later complete accepted Source can enroll that original seed/play. This does not update any immutable stored policy. A configured open window is complete enrollment with pending adjudication; it must persist and survive reopen.

Historical replay rechecks the immutable original seed/end/scope and admitted event chain. It replays captured admission evidence against the accepted action and Core algorithms; it does not reinterpret an old command under a newer current controller or manager. Persist exact admission owner IDs/revisions, canonical captured control/Club/appointment facts and their hashes in the receipt. New writes always recheck current authority. Existing current head changes must not retroactively relabel human action as Manager action.

Columns and raw Source/snapshot identity mirrors must agree, including duplicate/escaped JSON claims. A stored hash alone is insufficient: rederive from accepted Sources and authenticated dependencies, reject hidden aliases and corrupted prefixes, and retain bounded historical reads after later valid events.

## Closure fence

The journal reader reports current readiness; it never applies MatchState. The next closure integration will add the optional session revision/hash pin to the existing closure owner. Both directions must reject writes across an existing queued/applied closure reservation, including omission of the optional pin. No independent replacement ledger, scoring path or world reset is introduced here.

The additive accepted closure field is `postPlayReviewReference: { sessionSourceId, revision, headSourceId, headHash }`. It is optional for original v1 closures; omitting it must preserve their exact Source bytes/hash. A provided pin is an exact object with nonempty IDs, a nonnegative safe-integer revision and a SHA-256 head hash. Null, partial, additional readiness/ledger fields or arbitrary replacement rulings are invalid.

`deriveActualLiveClosureAdjudication(db, acceptedClosure)` is the narrow same-connection selector exported by `ActualLivePlayClosureEvidenceFromSqlite`. It returns the authenticated original `adjudication`, the selected `ledger`, and only when present the exact `postPlayReviewReference`. With a pin, it authenticates the stored session and its current head, binds the original seed ID/hash and requires `official_ready`. The closure tick must be at or after the owned journal cursor. An old historically ready revision does not authorize a current closure. Missing, pending, unresolved or stale owners cannot fall back to the original seed. Without a pin, an enrolled session is a blocking ownership claim, even when its current projection is ready.

The existing closure proposal uses this selected ledger in `closeOfficialPlay`, preserving its original seed timeline, imported on-field call, official application, scoring and next-play reset owners. Closure reads after enqueue/reopen authenticate the same pinned archive; the existing reservation fence prevents any subsequent journal write. This connection requires its own tests before implementation. The focused selector contracts include a synthetic reservation row only to exercise that reverse fence; they do not certify an actual enqueued or applied closure.

On the current optimized closure path, `deriveActualLiveClosureAdjudicationWithInputs` obtains the original seed/end/prefix through the existing `readWithClosureInputs` only for a genuine SQLite connection in an active transaction. It accepts a closure Source, never a caller snapshot or pair. The outer `withBattedWorldPhysicalReadTraversal` stays active through closure consumption, and the nontransaction/proxy path retains its original fresh reads. The selector's private reduction receives only this freshly authenticated seed. The 17-case selector/parser RED was observed before implementation; its GREEN is included in the current-source 256-case pass. This qualification remains separate from unmocked artifact acceptance.

## Test-first cases and evidence levels

Focused Native tests use genuine disk/WAL SQLite with mocked physical-domain readers. Their real current control/Club state, journal writes, triggers, rollback and close-all/reopen are exercised. These tests must be labeled as transaction/authority proofs, not original physical-chain proof.

1. Missing immutable seed or missing sealed end writes zero rows.
2. Each incomplete policy/opening/entitlement intake writes zero rows; retry with complete configuration for the same seed/play succeeds.
3. Complete enabled session persists open windows and the original call; identical retry returns the same receipt.
4. Assigned official request, explicit later decision and scheduler stamps round-trip across closing every connection and reopening the concrete store.
5. Stale parent/revision, foreign original play/Club, wrong scheduler, consumed intent and competing session produce no partial changes.
6. Human adoption checks actual current control, world revision, fixture side, Club and manager appointment. Independently change each owned fact and verify rejection with unchanged journal/head.
7. A Manager-labelled request with no matching review-domain trace remains unadopted; ROSTER and caller-only traces do not satisfy it.
8. After valid Human adoption, later control/appointment changes do not rewrite historical attribution, but stale new submissions fail.
9. Same-tick request after an explicit decline remains unresolved through later scheduler events and reopen.
10. Accepted callback changes, pre-BEGIN committed peer mutation, and writer-local post-INSERT changes to dependencies, authority or prior rows roll back completely. A write witness must prove the guarded insertion happened.
11. Hidden Source aliases, duplicate/escaped mirrors, deleted/replaced parents and coherent prior-row rewrites fail on read and acceptance.
12. Reads of revision N remain bounded after N+1; a historical read cannot be used as current write authority. Current closure reservations reject later journal writes.

After focused Native GREEN and review, run an unmocked original-chain proof on a separate copy of the accepted physical-end artifact: enabled explicit fixture policy, owned opening, accepted intent, resolution, close-all/reopen, unchanged original physical tables and the existing exactly-once official application. That artifact gate is mandatory before claiming the actual physical-to-review-to-official connection is complete. It is separate from the focused transaction tests and does not imply production NPB calibration.
