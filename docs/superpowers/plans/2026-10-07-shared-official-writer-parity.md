# Shared Official Writer Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing official application writes on a caller-owned SQLite connection without changing legacy behavior or adding terminal application support.

**Architecture:** Extract a connection-bound writer. It owns neither a database connection nor a transaction. The existing `SqliteOfficialStateStore` continues to open its private connection, initialize schema v2, and own its transactions. Both routes execute one extracted implementation of the current application writes.

**Tech Stack:** TypeScript, Node built-in `node:sqlite`, Vitest; no new dependency.

**Spec:** This is a bounded prerequisite of the approved `2026-10-05-owned-batting-intent-and-same-pa-foul-resume.md` plan. Its immediate contract is the current `src/host/SqliteOfficialStateStore.ts` behavior at commit `031d942585c540f2764c5125bb248ca7c59d833b` and `docs/core/sqlite-official-state-store-v1.md`. This document does not expand either into terminal lifecycle behavior.

## Global Constraints

- Preserve `SqliteOfficialStateStore` constructor and every current public method and type export, including pure `deriveOfficialPlayResult` and `deriveOfficialFinalResult`.
- Preserve schema version 2, schema DDL, request hash inputs, sorted-key serialization, row columns, error ordering, evidence-guard phases, and legacy transaction boundaries.
- Keep initialization and fixture registration as existing store-owned operations.
- The extracted writer performs no database open/close, PRAGMA, DDL, BEGIN, SAVEPOINT, COMMIT, or ROLLBACK. Its prepared write requires an active transaction on the supplied connection. Only the caller can commit the result.
- Each prepared write is opaque and single-use once admitted to an active transaction, including after a failed write or outer rollback. A second call in an active transaction throws `official state prepared write was already used`; obtain a fresh preparation to retry.
- Preparation captures a cloned inert request into a closure. A caller never supplies a trusted prepared body or result, and later mutation of its input cannot change the write.
- Activation checks existing application retry before result derivation and current finalized-state rejection. Finalization derives the result before transaction entry and retry lookup. Preserve this asymmetry.
- `retry`, `write`, and `written` evidence guards remain in their current relative order, including on the shared connection after application INSERT.
- No compiler, tests, database process, CI, publication, or merge while the coordinator's Q11b gate owns the runtime slot. Source/test authoring is permitted. Run the RED only after release.
- No UI/design changes. No terminal application receipt, pending-post-play format, schema v3, migration, process cutover, acknowledgement, workload settlement, reset or next-play permission is introduced.

## Review Focus

- Exact legacy serialization: verify raw `matches` and `applications` rows against an independent sorted-JSON/hash oracle on the unchanged baseline before extraction; do not rely only on two callers of the new implementation agreeing.
- Transaction ownership: an uncommitted result is visible only on the supplied connection; outer rollback also removes the caller's companion write.
- Failed writes: real INSERT-trigger and `written`-guard failures keep the transaction caller-owned and cannot leave committed partial state.
- Historical versus current input: preserve activation early retry, finalization derive-before-retry, retry after preparation races, duplicate closure, and stale revision rejection.
- Closure immutability: modifying the caller's request after preparation must not alter stored request hashes or returned results.

## Task 1: Extract the existing application writer

**Files:**
- Create: `src/host/SqliteOfficialStateWriter.ts`
- Create: `src/host/SqliteOfficialStateWriter.test.ts`
- Create: `tsconfig.official-writer-parity.json` (bounded parity/legacy/actual-live-stage import closure)
- Modify: `src/host/SqliteOfficialStateStore.ts`

**Interfaces:**
- Consumes: existing `PersistOfficialPlayInput`, `PersistOfficialPlayResult`, `PersistOfficialFinalInput`, `PersistOfficialFinalResult`, `PersistedMatch`, and `SqliteEvidenceGuard<PersistOfficialPlayInput | PersistOfficialFinalInput>`.
- Produces: `SqliteOfficialStateWriter(database: DatabaseSync, evidenceGuard?)` with `getMatch(matchId: string): PersistedMatch | null`, `getOfficialFixture(gameId: string): OfficialGameVenueBinding | null`, `prepareActivation(input): { kind: 'retry'; result: PersistOfficialPlayResult } | { kind: 'write'; write(): { readResult(): PersistOfficialPlayResult } }`, and `prepareFinalization(input): { kind: 'write'; write(): { readResult(): PersistOfficialFinalResult } }`.
- An active transaction is a prerequisite, not proof of transaction ownership. The terminal owner must later supply its own transaction/savepoint identity and evidence proofs.
- `write()` is bound to its original supplied connection. It requires `database.isTransaction` and throws `official state writer requires a caller-owned transaction` before any effect otherwise.
- Internal pure definitions may move into the writer module with backward-compatible re-exports from the existing module. Runtime imports must be acyclic. No public input/result shape changes.

- [x] **Step 1: Author the test-first contract.** Tests include three baseline cases that do not load the new writer plus focused shared-writer parity, guard, race, rollback, failure and immutability cases.
- [x] **Step 2: After coordinator runtime release, run the authored test file against unchanged production.** The three baseline cases must pass. Shared-writer cases must fail only at `shared connection-bound official writer must exist`; unrelated failures do not establish RED. Retain the exact baseline and test source IDs with the run's evidence. Capture the three `OFFICIAL_WRITER_BASELINE` raw-row fingerprints and replace their temporary diagnostic logs with fixed observed digest assertions before touching production; these assertions then stay unchanged across extraction.
- [x] **Step 3: Extract the connection-bound writer and delegate existing store methods.** Preserve code order and serialization verbatim where possible. Store `applyAndActivate` returns an early retry directly, otherwise opens its existing transaction around `prepared.write()`. Store `applyAndFinalize` prepares before opening its existing transaction and wraps `prepared.write()` identically. Both commit before calling the returned `readResult()`, preserving legacy in-transaction retry decoding/error order. Keep its existing rollback helper.
- [x] **Step 4: Run focused GREEN and compiler checks under the coordinator's bounded verification controls.** Select `src/host/SqliteOfficialStateWriter.test.ts`, unchanged `src/host/SqliteOfficialStateStore.test.ts`, and unchanged `src/host/world/ActualLiveOfficialStage.test.ts`. No skipped selected cases, unchanged source/control hashes, clean process exit and reaping are required. The full-project compiler remains a separate stage.
- [x] **Step 5: Inspect the final diff and obtain independent parity review.** Confirm the writer cannot open or end a transaction, baseline assertions remain unchanged, pure derivation and hash/bytes are unchanged, and terminal runtime code remains untouched.
- [x] **Step 6: Return the source checkpoint and verification scope to the coordinator.** Any suite or downstream consumer stage not executed remains explicitly unverified; this prerequisite is not Task 2B completion. Commit only locally if requested by the coordinator; do not publish or merge.

## Deferred terminal completion

The subsequent terminal owner must use its already-queued original proposal and one owned transaction for its official application and acknowledgement. Its pending-post-play representation, source-bound ownership checks, schema-v3 compatibility, and pre-open stop/reap cutover require their own independently reviewed contract and RED. In particular, this legacy activation API requires a world reset and must not be fed a terminal proposal by inventing one. The queue remains `QUEUED`, `officialApplied: false`, and `result: null` throughout this prerequisite.


## Observed baseline / RED

The bounded baseline/RED stage closed with supervisor exit 0 and expected Vitest exit 1: the three independent legacy baseline cases passed, and all eighteen shared-writer cases failed at the intended missing-writer assertion. All 21 declared case names matched, with no skipped, unhandled or setup errors. Source/dependencies/controls/runtime remained unchanged and no owned process remained. This is RED evidence, not an implementation pass.

The exact observed logical raw-row digests are now pinned as test assertions:

- live-ball: `b08a214083d8b2de904017f62cfbff293d1ffe70861bc0d89cc19fe31ff380c5`
- non-live: `d1a889b29ff892548673fadad8a8dbf39fb1873bd06a3de6876aa7c7b01f3721`
- final: `ff39e3d64aa2428a2fb481baea2f6657b8460cf3d60a9439c5b9e11ff2698bc3`

The implementation moves both pure derivations byte-for-byte. The legacy state-store and actual-live written-stage tests are unchanged. The corrected implementation subsequently passed the focused compiler, all 24 parity cases and all 17 unchanged legacy/actual-live-stage cases. See `docs/verification/2026-10-07-shared-official-writer-parity.md` for the precise scope and source identity; no whole-project pass is claimed.


## Reviewed retry-decode correction

Independent review found that the first extraction moved stored retry JSON decoding before the legacy COMMIT. A targeted test with malformed stored final-result JSON and a real retry-guard SQL witness failed exactly as predicted: the extracted store rolled back the witness that the original store commits before decoding. The bounded stage recorded one intended RED, 21 excluded cases with zero credit, unchanged input hashes, expected child exit 1, supervisor exit 0 and no remaining owned process.

The coordinator selected one small adjustment to this unpublished interface: `write()` returns an opaque `{ readResult(): T }` outcome. There remains exactly one write entry point and one consumed flag. The legacy wrapper calls `write()`, COMMIT, then `readResult()`. A borrowed transaction owner may call `readResult()` before committing and roll back if decoding fails. Activation preflight retry remains eager and unchanged. No SQL, evidence phases, request hash inputs or normal stored bytes change. The fixed baseline fingerprints remain unchanged.
