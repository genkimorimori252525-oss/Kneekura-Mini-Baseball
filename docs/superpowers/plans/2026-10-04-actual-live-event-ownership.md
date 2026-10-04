# Actual live event ownership implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the approved bounded sequence below.

**Goal:** Preserve source-local event/consumer/successor evidence and acknowledge actual first-base rule consumption without pretending to close live play.

**Architecture:** Add same-connection readers and immutable source-owned receipts. Physical source archives remain authoritative. Every checkpoint is a bounded graph of represented owners, not exhaustive generation or a writer fence.

**Tech Stack:** TypeScript, Node SQLite, Vitest

**Spec:** Approved world-first architecture/runtime/adjudication contracts in `docs/game-design/05-world-first-live-ball-architecture.md`, `06-world-first-runtime-contracts.md`, and `07-world-first-adjudication-contracts.md`; bounded event/consumer sequence in the current nonvisual continuation checkpoint.

## Constraints

No UI/design, workflow, dependency, remote, home CI, full verification run or existing physical writer changes. Preserve original sources and snapshots. Tests use one worker and shared Native/light locks. Positive PlayEnd, arbitrary acknowledgements, generator certificates and terminal flags are excluded.

## Review focus

- Confirmed acquisition occurrence precedes receipt availability; never backdate availability
- A source completes only alongside all original successors, still pending for their distinct consumers
- Rule-read existence is not an acknowledgement and truth is not an operative call
- Same-connection rederivation must reject writer-local triggers and peer WAL source mutation
- Historical receipts remain identical after later valid physical work; retries are idempotent, distinct acknowledgement Sources cannot consume the same event twice

## Task 1: Bound source-local evidence

- [x] Add red Native tests for capture receipt times, pending custody/rule successors, no generated-through claim, immutable reopen/retry and injected/corrupt Sources
- [x] Implement `ActualLivePlayQueueEvidenceFromSqlite.ts` deriving from original root and execution cut; preserve scheduled receipt payload and source-qualified identity
- [x] Implement `SqliteActualLivePlayQueueStore.ts` atomically storing the complete derived checkpoint with pre/post insertion same-connection validation
- [x] Run focused/adjacent tests and typecheck; commit separately

## Task 2: Own first-base rule consumption

- [x] Add red tests proving a rule read alone leaves pending, and a receipt consumes only its identified confirmed acquisition rule successor
- [x] Implement `ActualLiveRuleConsumptionFromSqlite.ts` and `SqliteActualLiveRuleConsumptionStore.ts`; accept only immutable Source IDs, rederive the canonical rule result and actual availability
- [x] Persist source-qualified consumer receipt and pending rule-result successor atomically; reject a second Source consuming the same event, retain same-Source retry
- [x] Add rollback, chronology, dependency-corruption and unchanged-archive tests; run focused/adjacent checks and typecheck; commit separately

## Deferred until immutable prerequisites

Integrate Native scheduled-motion v2 graph variants only once its reviewed source is fixed. Whole-generation coverage, transitive controller/information fixed point, all-route late-write fence, operative call/retirement and positive PlayEnd remain explicit missing owners.
