# Received-call Live Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute inline, with parent-managed final independent review.

**Goal:** Enroll one received defender/cause and persist null-policy then policy-bound Core replan, ending with renewal pending and immutable physical incumbent.
**Architecture:** Separate immutable enrollment/availability/process owners and journal. Metadata-only claim closure fences all fresh legacy admission; historical reconstruction stays independent of current CAS.
**Tech Stack:** TypeScript, Node 26 native SQLite, Vitest.
**Spec:** `docs/superpowers/specs/2026-10-08-received-call-live-enrollment-contract.md`, SHA-256 `d965e45f2fcfab2088afedc50ccf5446dcce211fc697d2cd4fa046f2d19d7c4f`.

## Global Constraints

- Preserve the v1 runtime/admission enum and received input/output; no motor, physical advancement, closure, UI or model/calibration invention.
- No genuine input copy or Native genuine execution until a separate parent-reviewed gate.
- Bounded tests use original pinned runtime/dependencies and independently frozen source/control census, one worker, 1024/1120/2048 MiB heap/measured/RSS, 4096 MiB reserve and 6400 MiB floor. Compiler uses 1408/1504/2048 MiB.
- No whole-suite credit from scoped runs; do not rerun old root/call/reception or expensive stages for bookkeeping.

## Review Focus

- Scope moves leave only a namespace-qualified dependency link: claim closure must still block.
- A first write fails after schema creation: all new namespace schema/rows must roll back.
- Caller enters evidence read with query-only ON: preserve it and the outer transaction.
- Later process payload is corrupt: historical earlier replay must not execute that payload.
- Same quantized tick but later exact elapsed time: never backfill selection.

## Task 1: Same-connection inert policy evidence

Files: modify `src/host/world/SqliteReceivedUmpireDefenderPolicyDataStore.ts`; create `ReceivedUmpireDefenderPolicyEvidence.test.ts` beside it.
Interface: `receivedUmpireDefenderPolicyDataEvidenceFromSqlite(db).read(sourceId)`, native main existing transaction, no schema/connection/authority lifecycle changes.
- [ ] Write Native fixture tests for committed original read, OFF/ON state preservation, missing transaction/facade/shadow/schema/dependency failures and absence of writes.
- [ ] Observe missing export RED under pinned supervisor; implement the bounded read export; observe GREEN.
- [ ] Commit the seam and verification evidence, with no new live ownership.

## Task 2: Fixed Source/schema and metadata claim closure

Files: create `ActualReceivedUmpireDefender.ts`, `ActualReceivedUmpireDefenderSchema.ts`, `ActualReceivedUmpireDefenderClaims.ts` and named contract/claim tests.
Interfaces: exact three Source validators/types; exact five schemas; finite namespace-qualified original/extension claim census, with no dependency replay.
- [ ] Write Source/bootstrap/graph tests covering every Review Focus scope case and unrelated shared Player/policy.
- [ ] Observe behavioral REDs; implement only schema/type/metadata behavior; observe GREEN.
- [ ] Commit this independently testable boundary.

## Task 3: Common legacy and terminal ingress rejection

Files: modify `ActualLivePlayFence.ts`, `SqliteActualFirstBasePlayEndStore.ts`, `SqliteActualFoulPlayEndStore.ts`; create `ActualReceivedUmpireDefenderIngress.test.ts`.
Interface: metadata-only applicable claims reject every fresh legacy owner and both terminal writes, including post-write rechecks; historical retries stay outside it.
- [ ] Write failing legacy-owner/game-play/terminal and post-insert-state tests using isolated Native metadata fixtures.
- [ ] Add guard calls, preserve no-claim behavior, observe GREEN and relevant legacy regression checks.
- [ ] Commit the guard boundary.

## Task 4: Enrollment and immediate pending fence

Files: create `ActualReceivedUmpireDefenderEvidence.ts`, `ActualReceivedUmpireDefenderJournal.ts`, `ActualReceivedUmpireDefenderTransaction.ts`, `SqliteActualReceivedUmpireDefenderEnrollmentStore.ts` and enrollment tests.
Interfaces: exact anchor/membership value; staged transaction; current original-owner proof; enrollment row + journal one and pending projection.
- [ ] Write derived-anchor/atomic-bootstrap/rollback and schema/write accounting tests; observe RED.
- [ ] Implement original historical reconstruction/current qualification separately; implement enrollment acceptance/retry/read; observe GREEN.
- [ ] Commit with independently measured evidence; no genuine copy.

## Task 5: Availability and durable two-revision process

Files: create `SqliteActualReceivedUmpireDefenderPolicyAvailabilityStore.ts`, `SqliteActualReceivedUmpireDefenderReplanStore.ts`, `ActualReceivedUmpireDefenderLiveWork.ts` and availability/process tests.
Interfaces: same-connection inert dependency; journal stages three/four; stable origin ID; exact previous Source/revision CAS; Core unchanged; one current obligation.
- [ ] Write binding/day/cut/late-selection/CAS/fork/no-op and historical-bound tests; observe RED.
- [ ] Implement exact available input and Core results, source-qualified history and pending-work projection; observe GREEN.
- [ ] Commit after rollback/callback/conservation faults pass.

## Task 6: Review and separately released genuine proof

Files: bounded genuine test + publication verification doc only after source review.
- [ ] Run relevant combined isolated tests and full-root compiler under approved caps; record exact results without claiming whole suite.
- [ ] Parent coordinates independent source review; address material findings with behavioral RED/GREEN.
- [ ] Prepare exact genuine gate/source/control allowlist, ask parent for runtime release, then use one fresh private copy and independent output inspection.
- [ ] Verify five schemas, ten row changes, original tables/admissions/head conservation, same Core-selected ball_handler and one renewal obligation; parent handles Draft PR publication.
