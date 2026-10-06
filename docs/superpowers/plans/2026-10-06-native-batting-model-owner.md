# Native batting model owner implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept and replay the registered Person's exact explicit batting model and real nested body receipt.

**Architecture:** Add a Native model composition owner on the caller's original SQLite connection. Reuse the existing body and Person evidence readers, transaction/ownership helpers and Core parameter validators. Archive explicit accepted parameters inside the immutable model snapshot; read/reopen uses archived bytes, while authority-backed retry compares fresh accepted input bytes.

**Tech Stack:** TypeScript, Node 26.10.0 node:sqlite, Vitest 2.1.9.

**Spec:** `docs/project-status/2026-10-06-native-batting-model-stance-contract.md` and the unchanged 30-case `src/host/world/PlayerBattingModelNative.test.ts`. The separately recovered contract document retains historical UNRUN wording; the fresh observed gate below supersedes that status only for its selected cases.

## Global constraints

- Start from recovered `ce9b7e88c5c4b8fbf47d012ae84cff0ccb31affe`; preserve all 67 frozen test cases byte-for-byte.
- MODEL only. Stance remains unqualified until its distinct observed RED after model acceptance passes.
- Preserve original registered `away-1/person-away-1/intake-away-1`, game-1/day10 and genuine nested body evidence.
- All six parameter inputs are explicitly accepted; no sensing result, prediction trajectory, emotion, motor result, swing adoption or numerical defaults.
- Current writes recheck original owners and immutable parameter pins inside one transaction; reads/retries retain original Source history.
- No runtime, locks, publication, workflows, home CI, design or UI work without the coordinator's stated release.

## Review focus

The existing contract covers foreign/future/missing evidence, getter/unknown-field rejection, changed same-ID Sources/parameters, SQL/JSON mirror mutation and trigger rollback. Source review additionally checks strict nested parameter validation, ownership claims across nested snapshots, deterministic applicable-day history, original-body revalidation and offline replay without callbacks.

## Task 1: Model composition owner

**Files:**
- Create `src/host/world/PlayerBattingModel.ts`: domain types and inert/strict accepted Source and parameter validation
- Create `src/host/world/PlayerBattingModelEvidence.ts`: same-connection body/Person reconstruction, immutable parameter pins, archive mirrors and day history
- Create `src/host/world/SqlitePlayerBattingModelStore.ts`: schema, transactional accept/read/select/retry and close
- Modify `src/host/world/PlayerMaterializationRuntime.ts`: model opener/type exports only
- Preserve the existing model, stance, fixture and 14 preservation files unchanged

**Interfaces:** `openSqlitePlayerBattingModelStore(path: string, authority?: BattingModelAuthority): BattingModelStore`, with the fixture's exact accepted/durable types and `.accept/.read/.selectAtDay/.close` signatures.

- [x] Preserve and verify the exact test-first cut.
- [x] Observe fresh full compiler PASS, 14 preservation PASS, genuine body prerequisite PASS, then the precise missing-model-owner assertion RED.
- [x] Implement the smallest exact model owner and compact durable RED checkpoint.
- [x] Obtain independent source review and fix concrete findings.
- [ ] Qualify four separate targeted guard REDs on the isolated pre-repair model source, after compiler/preservation/body/positive-model prerequisites pass.
- [ ] Prepare held full compiler, 30 model cases, four guard regressions, unchanged 14 preservation cases and related existing-owner regressions using the established finite controls and measured bounds.
- [ ] Run only after coordinator release; qualify selected counts, source/dependency/control pins, resources, cancellation and reaping. Whole suite/Pipeline completion stays false unless separately proved.
- [ ] Save the reviewed/qualified isolated cut, reporting exact source and observed evidence.

Fresh prerequisite receipt: `/workspace/shared/baseball-native-batting-recovered-stage-a-preparation-v1/attempt1/terminal.json`, SHA256 `923073f3a45b55a733abbbf98c7bcb6383a8297dbc4d389ecb6460d4758f465c`. Intended RED is `BATTING_MODEL_OWNER_MISSING` at fixture132, actual `undefined`, expected `function`. This receipt qualifies the feature's TDD entry; it does not qualify the implementation.
