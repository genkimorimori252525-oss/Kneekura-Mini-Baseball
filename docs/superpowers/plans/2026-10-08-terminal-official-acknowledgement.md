# Terminal Official-Child Acknowledgement Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute only within the coordinator's explicitly admitted runtime lane. This is a bounded continuation of the approved foul plan.

**Goal:** Bind the original terminal official obligation to its already durable non-live application with one immutable receipt, while all post-play and next-pitch fences remain closed.

**Architecture:** Add `acknowledge(sourceId)` to the existing terminal application runner. The same terminal row gains a distinct acknowledged-but-pending status and an exactly derived receipt; no accepted Source, journal event, table or consumer framework is introduced. An owned private-copy test controller installs the one extra terminal CHECK arm; neither production opener migrates storage.

**Tech Stack:** Existing TypeScript, Node SQLite, Vitest and sorted canonical JSON/SHA-256; no dependencies.

**Spec:** `AGENTS.md`; `docs/game-design/05-world-first-live-ball-architecture.md`; `06-world-first-runtime-contracts.md` §§9.5–10; `07-world-first-adjudication-contracts.md` §§9–9.1; approved `2026-10-05-owned-batting-intent-and-same-pa-foul-resume.md`; `2026-10-07-terminal-pending-post-play.md`; source-only proposal supplied by coordinator on 2026-10-08. Base pending source is `28868f1`, source tree `8c0ad51bc2e444b5ac97f6c697c0c76eae73d9fe`.

## Global constraints

- No runtime, imports, compiler, database open or tests before coordinated lane admission. Coordinator confirmed P11 and all three P17 cases at the base on 2026-10-08; runtime admission remains separate.
- Do not mutate the active pending checkout, regenerate physical evidence, discover artifacts automatically, upload private databases, start home-PC CI, merge, deploy or publish. Parent owns publication.
- Preserve E, C, all original physical pitch archives, physical acknowledgement, assigned official intent/call/fence/journal, Source/proposal bytes and all Match/application mirrors.
- No new timing, gameplay, scoring, workload, controller retirement, reset, same-PA resume, activation, nextWorld, finalResult or next-pitch authority.
- Synthetic tests establish strict encoding, metadata and mechanics only. Genuine behavioral RED must follow real pending application and authenticated P/C/E/journal/mirrors before production success behavior is written.
- Ordinary v2/legacy pending return shapes and serialized bytes remain exact. Official `user_version=3` remains unchanged. Arbitrary v3 schemas are not admitted.

## Review focus

- A stored consumed-looking object, missing receipt field, added key or status/null mismatch must reject; it cannot authenticate itself.
- Sole raw acknowledgement ID or application-reference Match/previous-play scope survives foreign cached IDs, escaped/duplicate keys and arrays and remains discoverable before parsing.
- Missing or damaged E/C/journal/application/Match siblings and a replaced pending marker reject on every read/retry.
- An AFTER UPDATE trigger that changes a sibling, inserts a competing claim or adds an unrelated write rolls the actual acknowledgement back atomically.
- Exact read/apply/enqueue/acknowledge retries preserve the later durable stage with zero writes and no new official writer invocation; both next-admission routes still reject.

## Exact operation and wire

`SqliteActualFoulTerminalApplicationRunner.acknowledge(sourceId: string): DurableFoulTerminalAcknowledgedApplication` accepts only a Source ID. The union gains:

```
{ source, proposal,
  status: 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY', officialApplied: true,
  result: { sourceId, official, acknowledgement } }
```

`apply` returns the applied-or-acknowledged union, preserving a later authenticated stage. Initial apply remains the same three writes and produces acknowledgement exactly null. Queue enqueue retry already returns its authenticated prior stage and must continue to do so.

For freshly rederived immutable proposal `p` and independently rederived/mirror-authenticated official result `o`, the exact frozen acknowledgement is:

```
{ version: 'actual_foul_terminal_official_acknowledgement_v1',
  acknowledgementId: json(['actual_foul_terminal_official_acknowledgement_v1',
                            p.officialObligation.obligationKey, p.source.sourceId]),
  obligationKey: p.officialObligation.obligationKey,
  originalSuccessorKey: p.originalSuccessorKey,
  scope: p.officialObligation.scope, status: 'consumed',
  consumer: o.pendingPostPlay.origin,
  physicalEndReference: p.physicalEndReference,
  consumptionReference: p.consumptionReference,
  officialReference: p.officialReference,
  applicationReference: { owner: 'applications', matchId: p.gameId,
    applicationId: o.receipt.applicationId, closureId: o.receipt.closureId,
    previousPlayId: o.receipt.previousPlayId,
    durableRevision: o.receipt.durableRevision,
    requestHash: o.pendingPostPlay.requestHash, receiptHash: hash(o.receipt) } }
```

`json/hash` are the existing sorted canonical codec and lowercase SHA-256. No receipt constructor becomes a public accepted-authority API. The owner derives expected bytes privately, then compares the entire row to the expected row. Its preparation method returns an acknowledged candidate only after an authenticated applied read within the runner's proof; it accepts no caller proposal or result. E's child remains exactly pending/null with `terminal_official_closure_unowned`.

## Storage and transaction

Keep the original `foulTerminalApplicationTableSql` unchanged as the explicit legacy schema and default new queue schema. Add one exact acknowledged-capable SQL constant, differing only by the non-null acknowledged status arm. Storage admission reports legacy versus acknowledged capability internally; both preserve the thirteen columns and six unique keys. Both `acknowledge` and acknowledged-stage reads require the new exact schema and schema v3, including when a row was inserted with CHECK enforcement bypassed. Both production openers do no migration; old exact readers reject the extended layout.

The test-support controller consumes only the explicitly pinned retained v2 producer receipt/control manifest. It checks closed regular sidecars, copies with exclusive creation into a fresh private directory, and verifies source/destination bytes before opening the new copy. This first copy advances only official version 2→3 and retains the legacy CHECK for real apply and the missing-method RED. For GREEN, after the genuine application/mirrors/writer witness pass, close the exact observed runner/observer handles, verify the connections are closed and sidecars regular/closed, and record a separate applied-stage control linking original producer control, applied bytes, raw census, schema and all mirrors. Exclusively copy this closed applied file a second time, verify byte equality, then rebuild only terminal CHECK while preserving rowid and every column. Reject any pre-existing extra terminal index/trigger, record old/new schema/index census, and prove all nonterminal schema/rows unchanged. This in-process control cannot admit a retained applied file and makes no unmanaged-writer exclusion claim.

Acknowledgement reuses the existing connection, BEGIN IMMEDIATE, unique savepoint, query_only proof, exact counters and retirement-on-cleanup-failure. Before update, authenticate original immutable history, current pending mirrors and ownership; pin all dependencies. Retry authenticates everything and returns with zero writes. First acknowledgement uses one compare-and-swap UPDATE matching all thirteen prior columns and rowid, changing only status/result_json. Require one changed row. Reauthenticate after the write; require exactly one total change, same installed main/temp/user schema, the one expected terminal row replacement and otherwise byte-identical raw pins including applications/Match. Trigger-induced changes and transaction replacement reject and roll back; no shared official writer runs.

Capture and compare target rowid separately because existing raw pins omit it. The distinct status detects partial stage/null/object mismatches; restoring both status and result_json to the exact prior applied-null bytes is an undetectable coherent rollback of one row. No external monotonic-history guarantee is claimed.

Raw ownership discovery adds acknowledgementId to identity closure and applicationReference `(matchId, previousPlayId)` scope. Acknowledgement ID remains a separate identity domain and is never confused with a Source/application/closure ID. It is seeded from the proposal's obligation+Source in scoped reads and discovered transitively from an intact selected row for Source-ID reads. Both public next guards include a sole surviving acknowledgement application-reference scope when an application receipt supplies the queried original play. Do not use nextMatchState.playId or consume unrelated earlier PA scope.

If only a raw acknowledgement ID survives, discover its embedded Source ID for rejection using parameter-bound SQLite JSON inspection of the ID's encoded array: exact version, length three and valid string elements. Preserve raw outer duplicate/escaped keys and array traversal. Noncanonical nested whitespace/escapes are still claims; wrong version/shape does not invent Source linkage. This linkage never authenticates an acknowledgement or equates its full ID to a Source/application/closure ID.

## Task 1: Contract, strict metadata and genuine RED

**Files:** This plan; new `ActualFoulTerminalAcknowledgementMetadata.test.ts`, `ActualFoulTerminalAcknowledgement.acceptance.ts`, `ActualFoulTerminalAcknowledgementCutover.test-support.ts`, `ActualFoulTerminalAcknowledgementWire.test-support.ts`, acceptance-only config and focused compiler config. Existing pending tests/config remain unchanged.

- [ ] Independently review this exact source/contract and test scope before production changes.
- [ ] Add A01 genuine acceptance: pinned producer → fresh legacy-CHECK v3 copy → real queued read/apply → independent original/pending-mirror assertions → `GENUINE_PENDING_TERMINAL_ACKNOWLEDGE_API_MISSING`. Only after the method exists does GREEN prepare the second acknowledged-CHECK copy described above. Missing imports or prerequisite failures receive no RED credit.
- [ ] Add metadata cases for ack-ID-only competitors, raw application-reference scope, duplicate/escaped keys/array ancestors, both next guards, earlier-PA preservation, exact schema refusal and legacy no-migration behavior.
- [ ] After P17 and lane confirmation, run focused RED and retain exact command, source and controller terminal evidence.

## Task 2: Minimal acknowledgement owner

**Files:** `ActualFoulTerminalApplication.ts`, `ActualFoulTerminalApplicationEvidenceFromSqlite.ts`, `SqliteActualFoulTerminalApplicationRunner.ts`, `ActualFoulTerminalApplicationOwnership.ts`, `FoulTerminalNextPlayGuard.ts`.

- [ ] After genuine RED, implement the exact types, private derivation, two exact storage layouts, stage authentication and single-row transactional operation above.
- [ ] Preserve later stage for exact apply and enqueue retries without callback requirement or repeated shared writer call.
- [ ] Run focused compiler and LIGHT metadata/schema tests under an admitted bounded lane.
- [ ] Run A01 genuine GREEN: witness actual update inside transaction; derive expected receipt from separately read E/C and pending receipt; exact one row/status/result change, raw/schema conservation, original pending E, read/apply/enqueue/ack retries, close/reopen and both admission fences.

## Task 3: Genuine rollback, corruption and review

**Files:** New `ActualFoulTerminalAcknowledgementRollback.acceptance.ts`; acknowledgement acceptance tests and verification record.

- [ ] In separately admitted fresh copies, install AFTER UPDATE triggers for E, original pitch, journal, shared application, Match pending marker and acknowledgement-only competing claim. Verify real trigger witness, rollback and unchanged schema/raw rows.
- [ ] On a genuine applied/acknowledged copy, cover stage/null downgrade, altered/extra/omitted acknowledgement fields, missing/damaged siblings and stale Match. Keep each run explicitly bounded and labelled.
- [ ] Use a real peer connection committed just before BEGIN IMMEDIATE in a test witness to prove fresh post-acquisition evidence; add no production callback.
- [ ] Run relevant unchanged ordinary handoff, pending, legacy v2 and prior-PA controls in separately admitted lanes. A second genuine terminal origin remains missing; fabricated metadata cannot close that gate.
- [ ] Obtain independent final review; document precisely passed, failed, never-run and retained artifact scope. Commit locally and return commits and evidence to parent for publication.

## Current status

Coordinator confirmed P11 baseline terminal `89de1c8e17c816716b31315cb7834f3a3345f23deaa45e82dbcd343e664afe38` and all three P17 rollback cases, terminal `7df524321fe5fe02389272f95744b246b9ee69a5f6251769a1c2b10e60787b85`, at unchanged base source with no remaining owned processes. Independent static review accepted the architecture subject to the RED-order, applied-copy provenance, schema-stage and rowid refinements incorporated above.

Under a separately admitted private LIGHT lane, the metadata-only tests observed 11 intended RED assertions, then the minimal rejection/discovery repair passed 22 new and 18 unchanged metadata/guard cases. The focused compiler passed after one test-support type-inference repair. See `docs/verification/2026-10-08-terminal-acknowledgement-metadata.md` for exact source and bounded evidence. Genuine A01 runtime remains held and no production acknowledgement success behavior or schema capability exists yet.
