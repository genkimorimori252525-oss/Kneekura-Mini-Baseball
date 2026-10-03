# Player Observation Model Implementation Plan

**Goal:** Own explicit immutable Player/Person-linked observation calibration, without inventing production defaults or changing world truth.

**Architecture:** A pure Core `PlayerObservationCalibration` validates and detaches the existing refresh, geometry, quality, error and memory parameter contracts, plus independent normalized `perceptionAbility`. Native accepts a versioned Source that pins the original accepted Player fielding model and Person intake link, snapshots that actual evidence, and verifies it on every read/retry/day selection and around transactional writes. This is one immutable baseline per career/Player, matching `SqlitePlayerFieldingModelStore`; no established sequential learning contract requires an update stream here, so later learning must introduce its own validated history rather than overwrite this Source or choose a magic latest version.

**Tech Stack:** TypeScript, Vitest, Node 26 `node:sqlite`, WAL, SHA-256 canonical evidence.

**Spec:** Foundation `44b9f5de:docs/game-design/00-current-design-handoff.md`; Realism `4f0a60a3:docs/game-design/{05-world-first-live-ball-architecture,06-world-first-runtime-contracts,07-world-first-adjudication-contracts}.md`; existing approved `docs/superpowers/plans/2026-09-18-observation-quality-geometry.md`, perception primitives and Player fielding baseline ownership. Latest explicit all-confirmed-nonvisual scope supersedes stale unapproved-DRAFT/no-autopilot status.

## Global Constraints

- World-first causality; Presentation remains read-only and unchanged
- No numeric production defaults and no promotion of test calibration into production
- Existing defensive ratings remain solely authoritative in the referenced Player fielding model; `perceptionAbility` is not inferred from `situationalAwareness`
- No view/attention state, actual observations, decisions, gaze inference, controllers, global team planner or complete-production claim
- No workflow/config/lock/dependency changes or remote writes; additive isolated files only
- Availability uses explicit `acceptedAtDay`, at or after referenced model and Person acceptance

## Review Focus

- Missing/extra nested fields, combined field-name tricks, accessors and nonfinite values fail closed before archive writes
- Weight totals must be finite and positive, including overflow from individually finite weights
- Foreign or future career/Player/Person/model evidence cannot be adopted
- Rehashed/rebound or mirror-only corruption in original evidence invalidates the stored calibration snapshot
- WAL triggers, callback mutation and hidden duplicate scope cannot leave a partly accepted Source

### Task 1: Core explicit calibration

**Files:** create `src/core/sim/perception/PlayerObservationCalibration.ts`, corresponding `.test.ts` and `PlayerObservationCalibrationFixtures.test-support.ts`.

**Interfaces:** `PlayerObservationCalibration` contains `perceptionAbility`, `refreshPolicy`, `geometryParameters`, `qualityParameters`, `errorParameters`, `memoryDecayParameters` using the existing Core parameter types. `createPlayerObservationCalibration(input)` produces a detached deeply frozen validated value.

- [x] Write RED tests for strict required fields, domains, finite positive weight total, immutability and direct existing-algorithm use
- [x] Run the focused Core test and establish the missing implementation failure
- [x] Implement strict inert validation without duplicating/replacing observation algorithms or defensive ratings
- [x] Run Core calibration plus existing perception regression tests

### Task 2: Native immutable owner

**Files:** create `src/host/world/SqlitePlayerObservationModelStore.ts`, corresponding `.test.ts`, `PlayerObservationModelFixtures.test-support.ts`, `PlayerObservationModelWal.test.ts`.

**Interfaces:** `AcceptedPlayerObservationModel` has `sourceId/sourceVersion/careerId/playerId/personLinkSourceId/fieldingModelSourceId/acceptedAtDay/calibration`. `DurablePlayerObservationModel` has `source` and verified original `fieldingModel`. `openSqlitePlayerObservationModelStore(path, authority?)` supports `accept(sourceId)`, `read(sourceId)`, `selectAtDay(careerId, playerId, atDay)`, `close()`. The optional authority only supplies newly accepted Sources; reopen/retry reconstruct from Native original records. `playerObservationModelEvidenceFromSqlite(db)` exposes the equivalent verified reader seam for later consumers.

- [x] Write RED tests for actual Player/Person/model identity, future day, missing source, malformed parameters, detached ownership, immutable retry/reopen and refusal of replacement baseline
- [x] Run focused Native tests to establish missing implementation failure
- [x] Implement Source validation, exact reference derivation, indexed/JSON scope checks, canonical mirrors/hashes/snapshots, and transactional before/after validation
- [x] Run focused Native tests
- [x] Write RED WAL tests for callback and after-insert original mutation, hidden duplicate scopes, rollback and recovery; confirm failures where absent, implement protections
- [x] Run focused Core/Native/WAL and existing fielding-owner/perception gates, then typecheck; the final integrated checkout owns comprehensive verification to avoid duplicate whole-suite work
- [x] Read-only review, address findings, rerun affected gates, and commit this isolated additive slice locally with explicit command-local identity

## Remaining boundaries

Accepted Sources still require an external calibrated authority; this slice generates no empirical values. It neither selects gaze/attention nor reads a live World to produce actual observations. It does not change the separate situational-awareness rating, fielding decisions, motion controllers, official outcomes, or presentation. Sequential player-development observation revisions are deferred until a validated history consumer is implemented, preserving this baseline and all source pins.

## Verification ledger

- Core/Native tests and fixtures were written first; the focused RED runs failed on the missing new implementation modules before production code was added
- Core explicit-input validator and existing perception regressions: 100 passing tests initially
- Native immutable-owner/WAL: 41 passing tests, including full rehashed Person/fielding rebinding detection and transactional rollback/recovery
- Self-review found a floating-point overflow edge: caller property order could hide a nonfinite total from the consuming quality algorithm. A dedicated regression failed before the fix and passed after validation adopted the existing algorithm's exact summation order
- Combined focused gate: 15 files / 178 tests passed, covering the new Core/Native/WAL owner and existing perception/defensive-ratings/fielding-owner consumers
- Final typecheck passed; read-only independent review found no remaining Critical/Important findings and reran all three new suites (102/102 passing). No full-suite or simultaneous-process contention stress claim is made
- Ruling: keep one version-pinned immutable baseline, matching the original Player fielding owner; no existing approved sequential observation-development consumer requires a new update protocol. If a later consumer requires revisions, it must own explicit validated history without replacing this accepted Source
- Ruling: the final integrated checkout runs the whole-suite gate above the concurrent scheduled-throw work; this additive worktree runs focused tests and typecheck, avoiding duplicate whole-suite execution as explicitly requested
