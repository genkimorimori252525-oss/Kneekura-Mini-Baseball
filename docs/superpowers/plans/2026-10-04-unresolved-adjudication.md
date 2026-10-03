# Unresolved Correct-Rule Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an explicit provenance-bound official call/review to close a play whose correct-rule interpretation remains unresolved.

**Architecture:** Keep resolved `CorrectRuleSnapshot` and its event/API byte-compatible. Add `UnresolvedCorrectRuleSnapshot` and its recording event/API; only the latest evidence state/replay becomes a union. Calls and reviews retain their existing provenance, freshness checks, and final-ruling shape.

**Tech Stack:** TypeScript, Vitest, existing SQLite host.

**Spec:** `docs/game-design/07-world-first-adjudication-contracts.md` §§6.2, 7; governing contracts 05 and 06.

## Global Constraints

- Physical PlayEnd stays the existing post-physical admission gate; preserve timeline bytes and event order
- No invented correct OUT/SAFE, automatic umpire, policy/deadline change, UI, result roll, or closure from simulation horizon
- NPB 2026 still configures appeal windows only; review tests exercise the generic ledger or an explicit test profile
- No workflow, configuration, lockfile, or home-PC CI changes
- Parent coordinates full-suite verification; this worktree runs focused single-worker regression suites and typecheck only

## Review Focus

- Replay of unresolved truth cannot fall back to an official gameplay ruling, even with forged closure data
- Fresh evidence across both variants stales old calls/reviews; duplicate snapshot IDs/revisions remain invalid
- Explicit review preserves the original call/truth and uses replacement only for overturned decisions
- Active input/replay getters cannot execute; malformed unresolved reasons or a supplied ruling cannot masquerade as unresolved evidence
- Existing resolved event/state/closure JSON stays unchanged; host persistence accepts the new event without a schema change

### Task 1: Record unresolved evidence and adjudicate it

**Files:** `src/core/adjudication/PlayAdjudicationLedger.ts`, `index.ts`, new `UnresolvedAdjudication.test.ts`, existing `src/host/SqliteOfficialStateStore.test.ts`, `docs/core/official-adjudication-v1-headless-api.md`.

**Interfaces:** Add `UnresolvedCorrectRuleSnapshot` with `snapshotId`, `evidenceRevision`, `resolution: 'unresolved'`, and `reason: 'exact_simultaneity' | 'insufficient_evidence'`. Add `CorrectRuleEvidenceSnapshot` union and `UnresolvedCorrectRuleSnapshotRecorded` event. Export `recordUnresolvedCorrectRuleSnapshot(ledger, expectedRevision, input)`; input contains event ID/tick, snapshot ID/evidence revision, and reason. Preserve all existing resolved APIs and serialized values.

- [x] Write tests for unresolved replay/recording, no-call closure rejection, explicit-call closure/application, confirmed/stands/overturned reviews, fresh evidence/stale provenance, open windows, same-tick order/physical immutability, inert validation, legacy bytes, and SQLite restart
- [x] Run focused tests and record expected missing-API/unknown-event RED failures
- [x] Implement the additive snapshot/event/API and shared monotonic evidence validation; block unresolved correct-rule fallback
- [x] Run focused single-worker adjudication, integrity/window/host/archive regressions and typecheck; document exact outcomes
- [x] Update headless API documentation, get fresh review, and commit only this slice; integration and Draft PR publication follow verified Source capture

## Execution record

- This bounded continuation implements canonical contract07 §6.2 under the current nonvisual implementation request; it introduces no new product design
- Baseline: `943d18cbfaaec0d2cfd269a12f46642d41c5ffcf`; isolated branch `codex/nonvisual-unresolved-adjudication-2026-10-04`

- RED: 21 failed / 14 passed in the new unresolved core and SQLite state suites. Failures were the missing new recording API or unknown new replay event; the legacy byte fixture and existing SQLite tests stayed green.
- GREEN: the same two files passed 35/35 after implementation. Typecheck passed. npm emitted its pre-existing environment http-proxy warning and an npm update notice; no test/compiler warnings or failures.

- Bounded regression gate: `npm test -- src/core/adjudication src/host/SqliteOfficialStateStore.test.ts src/host/SqliteOfficialScoringStore.test.ts src/host/world/SqliteBattedContactResponseStore.test.ts src/host/world/BattedContactResponseWal.test.ts src/host/world/OfficialWorldSettlementDriver.test.ts src/host/world/SqliteOfficialWorldSettlementOutbox.test.ts --maxWorkers=1 --minWorkers=1` passed 20 files / 142 tests in 94.98s, including Native archive/restart and WAL rollback checks.
- `npm run typecheck` passed; `git diff --check` passed. Full-suite validation is a separately tracked fixed-Source integration gate; these focused results do not imply whole-suite completion.

- Fresh independent review found no material issues and reran the two focused files: 35/35 passed; diff-check passed. No production or test changes were requested.
- Ruling: retain existing resolved type/event/API bytes and add a separate unresolved variant; open-state consumers now narrow the evidence union before accessing `ruling`. This is the necessary type-safe representation of contract §6.2, without expanding Native umpire ownership or RuleProfile policy.
