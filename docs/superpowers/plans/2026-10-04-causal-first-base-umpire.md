# Causal First-Base Umpire Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. The parent owns independent review and schedules Native tests.

**Goal:** Produce an owned first-base call from independently perceived real event ordering, with no truth-result shortcut or production calibration defaults.

**Architecture:** Existing Native first-base-race evidence owns legal applicability and the exact event pair. Existing observation geometry, occlusion and quality feed a versioned seconds-domain extension of the established symmetric-triangular capture law. A frozen static umpire setup and observation schedule a call; a separate actual-clock advance adopts it only when due. Operative batter participation is an additive projection, distinct from physical motion and PlayEnd.

**Tech Stack:** TypeScript, Vitest, node:sqlite, existing Native immutable Source/evidence conventions

**Spec:** docs/superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md §§6–10,13; docs/game-design/05-world-first-live-ball-architecture.md §5.1; docs/game-design/06-world-first-runtime-contracts.md §10.1

## Global Constraints

- Canonical Physical Truth → observable information → umpire perception → on-field call
- Preserve Physical Truth / Correct Rule Result / OnFieldCall / Final Official Ruling separately
- No UI, workflow/config/lock edits, home CI, publication or merge
- Static pose and calibration are explicit accepted versioned inputs, never inferred defaults
- Missing pose, attention, calibration, legal applicability or actual event pair stays pending; nondetection stays distinct
- Exact occurrence and actual confirmation/observation/call availability stay separate, including same-tick fractional events
- No invented acknowledgement, retirement-derived motor cancellation, settled_for_play or PlayEnd
- Native tests require parent scheduling; pure checks use Node26, one worker and /workspace/shared/baseball-light-check.lock

## Review Focus

- Secure occurrence preceding confirmation: knowledge/call cannot precede the actual confirmed prefix
- Missing/occluded event: no perfect-umpire or correct-rule fallback
- Caller-injected ruling/time/truth: reject at accepted Source boundary
- Same integer tick, different exact times: do not make a later call available to an earlier decision
- Mutated dependencies/head/Source mirrors during SQLite writes: roll back the complete new delta

## Files and Ownership

- src/core/sim/perception/ObservationCapture.ts: additive scalar temporal capture using the existing sampling law, no legacy output changes
- src/core/sim/perception/FirstBaseUmpirePerception.ts: explicit calibration, geometry/quality-driven two-event perception, estimate-only classifier and exact call schedule
- src/core/sim/perception/FirstBaseUmpirePerception.test.ts: pure causal/calibration/availability tests
- src/host/world/ActualFirstBaseUmpire.ts: actual event extraction from the original owned field/race prefix and immutable call/disposition contracts
- src/host/world/SqliteActualFirstBaseUmpireStore.ts: setup, observation and call Source owners; same-connection reconstruction/transactional current-cut guards
- src/host/world/ActualFirstBaseUmpireFixtures.test-support.ts: explicit synthetic calibration/setup on actual Native fixtures
- src/host/world/SqliteActualFirstBaseUmpireStore.test.ts: Native causal results, pending/clock/reopen/injection and unchanged archives
- src/host/world/ActualFirstBaseUmpireIntegrity.test.ts: corruption, stale cuts and transaction mutation probes

## Task 1: Parametric Perception and Estimate-Only Classifier

**Consumes:** Existing ObserverViewState, ObservationTargetTruth, ObservationGeometryParameters, ObservationQualityParameters, SphericalOccluder and DeterministicRng

**Produces:** createFirstBaseUmpireCalibration; perceiveFirstBasePlay; classifyPerceivedFirstBasePlay; resolveFirstBaseCallSchedule

- [x] Write failing tests for real ordering, reproducible miscall, geometry/attention/ability dependence, missing and undetectable inputs, explicit temporal ranges, estimate-only classification and exact schedule availability
- [x] Run pure tests RED and capture immutable source hashes
- [x] Add temporal observation sampling and minimum model implementation; no fixed correctness-rate or arbitrary empirical default
- [x] Run pure tests GREEN plus adjacent perception/RNG suites and typecheck; capture before/after source hashes
- [x] Commit the pure component

## Task 2: Owned Native Perception and In-Play Call

**Consumes:** Task 1 functions; battedWorldFieldExecutionEvidenceFromSqlite; battedWorldFieldPhysicalPrefix and immutable first_base_race execution

**Produces:** openSqliteActualFirstBaseUmpireStore, actualFirstBaseUmpireEvidenceFromSqlite and derived sole-batter operative disposition

- [x] Write failing Native tests using a real grounded/confirmed-control/foot-touch prefix and synthetic accepted static pose/calibration
- [x] Ask the parent to schedule the Native RED test run, with source hashes pinned before/after
- [x] Implement strict accepted setup/observation/call Sources; extract actual target geometry at both events; actual horizon owns observation availability; call schedule never reads correctRuleResult
- [x] Keep absent pair/applicability/model pending and no detection distinct; derive OUT retirement only from an adopted operative OUT, without modifying bodies, motors, touches or correct-rule rows
- [x] Add corruption, stale cut and transaction mutation tests before fixing each corresponding guard
- [x] Run parent-scheduled Native causal/integrity gates; perform pure adjacent checks/typecheck under the light lock; broad Native regressions remain explicitly unrun
- [x] Commit source/tests/docs only after supplied verification evidence; preserve all old archives

## Interface and Calibration Decisions

The parent approved the bounded timing seam on 2026-10-04: scalar seconds calibration extends the established quality-scaled symmetric-triangular law. Each event has its own deterministic umpire stream. Classification compares perceived defender-control time with perceived runner-touch time; a perceived exact tie stays pending. Both real events must exist and be legally applicable in the pinned confirmed rule prefix. The current slice intentionally waits for the actual pair rather than predicting a future runner arrival.

The explicit static view applies only over its accepted interval. Sparse event samples establish instantaneous observation duration (0 seconds), never continuous visual coverage. Call delay is supplied explicitly, and original observation/call identities remain frozen after later physical execution or review. Missing runtime data is a deployment/calibration blocker, not an ideal-umpire mode.

## Execution receipt

See `docs/project-status/2026-10-04-causal-first-base-umpire-checkpoint.md` for actual gate outcomes, the preserved aggregate failure/test-only correction, supported legacy-base scope and remaining v2/registry/communication integration boundaries. The parent owns independent review.
