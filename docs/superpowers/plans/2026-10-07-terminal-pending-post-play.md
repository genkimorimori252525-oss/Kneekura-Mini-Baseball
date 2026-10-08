# Terminal Bunt Pending Post-Play Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. This is the next bounded functional slice of the existing approved non-design foul plan, not a new game-design capability.

**Goal:** Consume an authentic durable `QUEUED` terminal-bunt Source exactly once, apply the canonical non-live Match, and durably retain an explicit post-play block without inventing setup or next-play authority.

**Architecture:** The queue remains the original accepted Source/proposal owner. A distinct schema-v3 runner owns one connection and one transaction and borrows `SqliteOfficialStateWriter`. The writer derives the non-live receipt without activation. Three exact persisted mirrors identify the pending result: the terminal result, shared application result, and Match pending marker. Reads rederive the immutable original P/C/E/journal proposal, then authenticate the stage-specific mirrors and raw ownership census.

**Tech Stack:** Existing TypeScript, Node SQLite and Vitest. No new dependencies.

**Spec:** `AGENTS.md`; `docs/game-design/05-world-first-live-ball-architecture.md`; `06-world-first-runtime-contracts.md` §§9.5–10; `07-world-first-adjudication-contracts.md` §§9–9.1; `docs/superpowers/plans/2026-10-05-owned-batting-intent-and-same-pa-foul-resume.md`, terminal-bunt boundary. Exact prerequisite commit: `79fd8bb294d11e60af762b63799e8294da514483`.

## Global constraints

- Keep original physical pitch archives, complete ordered physical prefix, count, end, assigned call ID, original official ledger, world and participant evidence unchanged. The canonical call ID is not its enclosing event ID.
- Require an existing genuine queue. No caller proposal, outcome, receipt, synthetic pitch snapshot, timing or world setup is accepted by `apply(sourceId)`.
- Terminal application is non-live and grants neither activation, nextWorld, acknowledgement, workload settlement, reset nor next-pitch admission.
- Preserve all legacy v2 return shapes and serialized bytes. The current store accepts v3 without downgrading it; the exact frozen v2 official-store constructor must reject a v3 reopen. The old terminal queue opener does not reject v3, so this is not an all-old-writer fence.
- No arbitrary/shared-database migration. No Boolean, marker or lock file is a proof of old-process quiescence. No claim covers unmanaged external writers.
- No runtime until coordinator release. No CI, merge, publish, UI/design, ordinary-foul same-PA or geometry changes.

## Concrete interfaces and files

1. `src/host/OfficialPendingPostPlay.ts` defines `PersistOfficialPendingNonLiveInput` (existing terminal body plus an origin reference), `OfficialPendingPostPlay` and `PersistOfficialPendingNonLiveResult`. The origin is `{owner:'actual_foul_terminal_applications',sourceId,sourceVersion,sourceHash,snapshotHash}`; `snapshotHash` binds the immutable proposal. Result is `{receipt,pendingPostPlay}`. The marker binds version, Match ID, application ID, closure ID, previous play, durable revision, origin, canonical game progression and `requestHash = SHA256(sortedCanonicalJSON(input))`. Match storage is exactly sorted JSON of `{pendingPostPlay:marker}`; application result is exactly sorted JSON of `{receipt,pendingPostPlay:marker}`. `receipt.closureId` must equal `origin.sourceId`. No next-start tick or world setup is accepted.
2. `SqliteOfficialStateWriter.preparePendingNonLive(input)` returns the existing single-use `{kind:'write',write():{readResult():PersistOfficialPendingNonLiveResult}}`. Its request hash is the sorted canonical pending input, whose `mode:'non_live_pending_post_play_v1'` separates it from old requests. It requires schema v3, derives through `deriveClosedNonLiveMatchState` and `confirmDurableClosedNonLiveStateApplication`, checks current Match/revision/fixture, rejects prior pending/final state and duplicate closure, then writes Match and application only. Same-request retries verify the stored result against the deterministic derivation. It owns no transaction.
3. `PersistedMatch` gains an optional `pendingPostPlay` field, emitted only for a pending marker; legacy objects have no new key. Pending decode returns null activation, nextWorld and finalResult and checks receipt/marker/state, application identity and requestHash consistency. Its canonical envelope is strictly exclusive: mixed activation/finalResult, extra keys, duplicate keys and noncanonical encodings reject. Both legacy fresh application paths reject pending state. Exact historical legacy retries retain their old behavior.
4. `ActualFoulTerminalApplication.ts` retains the existing queue type and adds the applied union member: `{source,proposal,status:'OFFICIAL_APPLIED_PENDING_POST_PLAY',officialApplied:true,result:{sourceId,official,acknowledgement:null}}`. Store reads/enqueues return the union. The original proposal remains `officialApplied:false` because it is immutable prepared evidence.
5. `ActualFoulTerminalApplicationEvidenceFromSqlite.ts` authenticates both stages, exposes a current queue proof plus raw pin, and validates the exact expected official application/Match/terminal claims. It derives the pending official result from original evidence, never the stored result. Applied reads require all three mirrors and reject missing, changed, extra or foreign ownership. At this slice, there is no later legitimate completed stage to accept.
6. `src/host/world/SqliteActualFoulTerminalApplicationRunner.ts` exports `openSqliteActualFoulTerminalApplicationRunner(path):{read(sourceId),apply(sourceId),close()}`. Opening requires an already-v3 existing regular-file artifact and mandatory installed tables, checked before writer PRAGMAs; missing paths, :memory:, v2 and >3 reject without accidental creation or DDL. It performs no migration. `apply` owns BEGIN IMMEDIATE and a unique savepoint, authenticates a current queued proposal with read-only proof, calls the shared pending writer, changes only queue status/result, then rederives all evidence and verifies exact raw pins/schema/three-write accounting before COMMIT. Failed proof rolls back all three writes. Exact applied retries read-authenticate only and write zero rows.
7. Existing prior-closure admission guard gains terminal raw-mirror rejection before the legacy live/physical fallback, covering a pending application ID from each raw terminal/application/Match mirror independently even if another is damaged or deleted. This guard precedes the live-owner early return and the historical actor activation fallback. Pending marker-only `{matchId,previousPlayId}` scope also participates in the rejection census, without using any nextMatchState.playId. No path interprets the marker as a next-play activation.

## Cutover producer/consumer contract

The production runner consumes only schema v3; it neither copies nor upgrades a database. The qualifying controller/test-support producer owns the cutover:

- Build the genuine terminal fixture and queue in a newly created private v2 producer directory, not an original/shared database.
- Close its owner handles, terminate its owned v2 process and await observed exit/reaping. Record exact artifact identity and source/runtime evidence. Do not open/migrate a v3 artifact before this event.
- After stop/reap, copy the closed database to another newly created private destination with exclusive creation. Preserve original database bytes and record before/after hashes. WAL must already be checkpointed/closed; fail rather than silently omit live WAL.
- Open only the new destination and set `PRAGMA user_version=3` under the controller's transaction. Reopen with the exact frozen `031d942:src/host/SqliteOfficialStateStore.ts` implementation and observe its schema-version rejection; then open with the new runner. No API takes a caller `quiesced:true` claim.
- The consumer proves genuine application, close/reopen, exact retry, no next-play right, original raw-row conservation and three mirrors. This establishes only the owned new-private-artifact cutover used in this verification.

## Review focus and tests

- Pending receipt is data, not activation: assert null activation/nextWorld/finalResult, no invented timing/world fields, legacy apply/finalize and physical next-admission rejection.
- Exactly-once with authentic source: queue required, one official application and one Match revision, retry/reopen unchanged, changed source/proposal or any result mirror rejects.
- Atomic failures: real SQLite trigger failures after Match update, application insert and terminal update roll back all effects. Added/mutated original rows or raw-only ownership claims reject and roll back.
- Original authority: historical original-source rederivation survives current Match advance; selected call basis and original batted-ball-pending pitch remain byte-identical; fresh application still needs current selected journal/Match.
- Cutover and compatibility: old process really stops before private v3 migration; old binary rejects v3; legacy raw fingerprints remain exact on v2 and no constructor downgrades v3.

## Execution steps

- [x] Independently review this concrete contract before production changes.
- [x] Author focused pending-writer/admission tests and genuine Native application/rollback/reopen tests first.
- [x] On runtime release, run them against unchanged production and observe intended missing pending API/behavior RED after prerequisites.
- [x] Implement the minimal functions above; do not add an acknowledgement placeholder that claims consumption.
- [x] Run focused compiler and bounded GREEN plus unchanged 24 writer parity/17 adjacent checks under coordinator controls. Full suite stays explicitly unqualified unless separately run.
- [x] Obtain independent code/contract review; return exact source IDs and evidence scope.

## Next dependency

The genuine pending checkpoint still owes an authenticated terminal official-child acknowledgement and complete post-play/scoring/workload/reset readiness. An acknowledgement owner must bind the same E obligation, consumer Source and durable application receipt atomically, without rewriting E or granting a next-play right. This slice deliberately stops before that new owner exists.

## Independent review acceptance refinements

The source-only reviewer approved the bounded architecture, with no runtime or production-code approval implied. The following are now part of this contract:

- Source hash binds the exact accepted Source; snapshot hash binds the immutable proposal; receipt closure ID equals origin Source ID. Derive game progression anew from original Match and receipt. A null policy is permitted only for an established same-half, unchanged-score transition. Runtime input parsing rejects extra timing/setup/activation fields.
- `getMatch` does not recursively call the terminal reader. It strictly checks the exclusive canonical pending envelope and shared application's identity, request hash, receipt, marker and Match state. Complete original-source authentication remains the terminal owner.
- Only pre-write first application requires the current selected journal and original current Match. Post-write/retry uses historical original-source rederivation plus exactly the expected current pending Match; it never demands the already-replaced original Match. A stale historical QUEUED read remains valid history but grants no application eligibility.
- The allowed owner set is exactly one terminal row, one shared application row and one Match row. Original session/event/intent ancestors remain linked provenance, not competitors. Marker-only Match/previous-play scope must remain discoverable with foreign cached IDs, origin IDs and damaged/missing receipt. Legitimate earlier-PA activations remain excluded.
- Both public next admission and historical `readActualLivePhysicalActivation` must run terminal raw-mirror rejection before any live/physical fallback or absent-owner early return. Test each independently surviving mirror.
- The application opener validates a regular existing file, schema version exactly 3 and mandatory table ownership before writer PRAGMAs; it cannot create, migrate or run DDL. Real application changes exactly three rows on an already-migrated baseline and preserves raw original pins/schema.
- The frozen v2 compatibility assertion is only the official-state store entry point. The old terminal queue constructor does not reject v3; owned process stop/reap and the exclusive new private copy establish this test's safety boundary.

## Test process and retained-artifact scope

Focused synthetic tests establish writer mechanics, strict parser/decoding, schema refusal and raw metadata rejection only; they are not original P/C/E proof. The P11 Native positive has exactly one fresh producer fixture and one queue enqueue (or one explicitly controller-admitted retained producer), one queue read, one absent-Source apply rejection, one actual apply, one exact apply retry, one close/reopen read, one next-admission rejection and one pending getMatch. It performs no fault mutation loops. The producer has a 1200-second case cap; the parent case has a 2400-second cap. Root controller wall/RSS/heap caps remain separately admitted.

The child inherits exact Node options and inherited shared lock descriptors, uses one thread worker, writes its own report/stdout/stderr, and is awaited through owned ChildProcess exit and close. Its birth identity/runtime hash is retained; no later numeric PID is signalled or treated as the original child. Successful producer/receipt files are preserved on consumer failure and for separately admitted rollback cases. A retained producer is accepted only through an explicit pinned `TERMINAL_PENDING_CUTOVER_INPUT` control manifest. There is no automatic path search or silent physical regeneration. Every consumed artifact, receipt and log digest belongs in that stage's admitted control list.

### Exact new wire contract

All new JSON below is serialized by the existing recursive sorted-key JSON codec, with no omitted or extra keys. Hashes are lowercase SHA-256 of UTF-8 canonical JSON. The pending request is exactly the immutable proposal's `applicationBody` plus `origin`. The proposal itself is never changed to contain an origin.

```
origin = { owner: 'actual_foul_terminal_applications', sourceId, sourceVersion,
           sourceHash: hash(acceptedSource), snapshotHash: hash(immutableProposal) }
pendingPostPlay = { version: 'official_pending_post_play_v1', matchId,
                   applicationId, closureId, previousPlayId, durableRevision,
                   requestHash: hash(request), origin, gameProgression }
official = { receipt, pendingPostPlay }
terminalResult = { sourceId, official, acknowledgement: null }
Match.activation_json = json({ pendingPostPlay })
applications.request_hash = hash(request)
applications.result_json = json(official)
actual_foul_terminal_applications.result_json = json(terminalResult)
```

`gameProgression` is the existing `OfficialGameProgression` union, or exactly `{kind:'same_half_no_game_boundary'}` for the accepted null-policy case. Neither `GAME_CONTINUES` nor `GAME_FINAL_PENDING_SCORING` is a next-play or final-result receipt. Match `state_json` equals `json(receipt.appliedMatchState)` and durable revision equals the receipt; the proposal expected revision increments exactly once.

The producer's 1200-second cap is enforced twice: its source-level case timeout is conditional on producer mode, and its parent starts an external child wall timer with owned-handle TERM then KILL cleanup. A closed regular SHM may retain nonzero bytes; only WAL must be absent or zero-length. Both existing sidecars must be regular canonical files. Retained producer admission additionally binds the exact successful one-case child report to the original admitted parent configuration and completed supervisor terminal, including pinned source bytes, process birth identity/runtime and no remaining owned processes. It never treats a standalone `observedExitAndClose` Boolean as sufficient lineage.

P11's independent raw oracle snapshots the already-v3 main/temp schema, explicit index metadata, schema/user versions, and every rowid plus full raw row in all three write-target tables. It compares the exact one Match UPDATE, one application INSERT and one terminal UPDATE, rather than excluding those tables wholesale. No extra row is invented in this genuine positive artifact. The missing second genuine terminal origin remains a separate qualification gate; raw foreign claim fixtures remain in the metadata tests. The full census and schema must remain identical on retry and reopen. All other tables retain their original pre-copy logical rows.

Controller-dependent P11/P17 cases use `.acceptance.ts` filenames and the explicit acceptance-only `vitest.terminal-pending.config.mjs` include list. Ordinary `npm test` does not discover them. P11 additionally requires the private runtime/lock envelope before it can start a producer; renaming occurred before any P11/P17 execution or evidence. The five missing-runner unit cases remain explicit unfinished tests until the genuine RED permits implementation.

## Partial execution record

The independently reviewed shared-writer/getMatch/raw-guard portion reached focused compiler plus 72 selected LIGHT passes at `cbab491`, after an observed two-route historical-scope RED and minimal previous-play scope repair. One canonical JSON/hash implementation was moved byte-for-byte into `OfficialStateEncoding.ts` to avoid a pending/writer import cycle. The two controller-expectation failures and the test-only TypeScript alias failure remain recorded with zero credit. Genuine application runner creation is still held until P11 observes its missing API after real queued/cutover prerequisites; no runtime precondition was waived. See `docs/verification/2026-10-07-terminal-pending-writer-partial.md` for exact scope and terminal hashes.

## Runner checkpoint, 2026-10-08

The genuine missing-runner RED has now been observed after the authentic owned-producer/cutover prerequisites. The runner implementation and independent-review orphan-mirror repair qualify the focused compiler plus 84 selected LIGHT cases at `562ad1e`, src tree `8c0ad51bc2e444b5ac97f6c697c0c76eae73d9fe`. P11 GREEN and the three P17 real-writer rollback cases remain held for coordinated runtime using the explicitly pinned retained producer. The previous section is the historical pre-runner checkpoint, not the current implementation state. See `docs/verification/2026-10-08-terminal-pending-runner-bounded.md` for exact attribution, limits and receipt hashes.

## Genuine qualification, 2026-10-08

P11 genuine application/retry/reopen and all three P17 real-write rollback cases passed in separately released retained-producer stages at `28868f1`, with the same src tree `8c0ad51bc2e444b5ac97f6c697c0c76eae73d9fe`. No physical evidence was regenerated. The bounded total is focused compiler plus 88 selected passes; no full-suite or second-genuine-origin pass is claimed. The earlier held checkpoint above is historical. See `docs/verification/2026-10-08-terminal-pending-genuine-qualified.md` for exact attribution and terminal hashes. The pending application slice stops here; official-child acknowledgement remains the next owner extension.
