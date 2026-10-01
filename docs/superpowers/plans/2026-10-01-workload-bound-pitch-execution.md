# Workload-bound physical pitch execution Implementation Plan

**Goal:** Connect actual accepted global Player fatigue to subsequent canonical physical pitch motion/flight, preserving historical reproduction and existing history owners.

**Authority:** User-approved latest confirmed nonvisual work. Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d documents14/32/53/55 require actual fatigue -> execution, no calendar-density/outcome/League/Nation modifier and no hidden National return reset. Realism branch a39951526e1e541c457d8616dcebe474847e1225 adds only visual assets relative to the previous frozen implementation source; nonvisual contracts are unchanged.

**Architecture:** Add a validated historical workload revision selector to the existing workload owner. Core derives temporary motion duration and release velocity/spin from fatigue and an independently accepted explicit response calibration. Preserve long-term timing/body/release sources. A small Native response-policy owner freezes accepted policy Source/version and exposes replay-validated reads. A new Host runtime entry point pins workload revision and policy Source, reads actual Native timing/release history and calls the existing physical pitch runtime with derived physical parameters. Existing entry points stay compatible.

**Interfaces/files:** Core `applyPitchFatigueToExecution` in `src/core/sim/pitch/PitchFatigueExecution.ts` takes actual fatigue, timing profile, nominal physics, policy and gameDay. Existing `SqlitePlayerWorkloadRecoveryStore.selectAtRevision` returns the exact archived state after validating all history. New `SqlitePitchFatiguePolicyStore.accept(sourceId)` / `readAcceptedPolicy(sourceId)` freeze independent policy Source/version. `WorkloadBoundPlayerPitchRuntime.resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld` accepts a serializable existing physical request with `delivery.matchSeed` instead of the `SeedRoot` instance, plus `workloadRevision` and `policySourceId`; it returns the actual physical result and detached provenance. No caller fatigue/long-term skill mutation is accepted.

**Policy:** Exact policyId/version/availableAtDay and finite motionDurationScaleAtFullFatigue >=1, velocityRetentionAtFullFatigue and spinRetentionAtFullFatigue within0..1. Interpolate by accepted fatigue within0..1; scale actual normal-motion/follow-through durations and velocity/spin vectors. Quantize durations as safe positive integer microseconds; reject overflow. No hidden production numeric defaults, new RNG, force outcomes, pitch-count-to-out shortcut, long-term skill modification, release-coordinate jitter or additional classification/trait buff.

## Task1: Core response and historical workload selection

- Capture missing APIs RED on actual Native baseline/activities/recovery/reopen and actual Core physical flight.
- Add selectAtRevision(careerId,playerId,revision) after full existing history replay; only archived exact revision0 or activity AFTER states qualify, reject missing/future/invalid/corrupt history.
- Implement pure temporary fatigue response with explicit policy validation; fresh fatigue0 preserves original execution, higher fatigue causes calibrated physical change, invalid/future policies and arithmetic overflow fail.
- Verify old selected revisions after later recovery still match their original fatigue; no elapsed-day/calendar reset.

## Task2: Frozen policy and actual runtime connection

- Archive independently accepted response policy Source/version, detect changed live facts and stored corruption, offline original reads/retry, late-write rollback and same-version conflicts.
- New resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld uses exact actual workload revision and frozen policy, derives temporary physical parameters and delegates actual canonical timing/release -> trajectory -> existing take/swing physical paths.
- Actual Native generated official pitch workload from PR236 -> global fatigue -> later physical pitch slower motion/release velocity/spin -> actual plate crossing. Accepted recovery changes future execution; original revision reproduces before/after recovery and reopening. No caller fatigue accepted, no duplicate charge, long-term histories unchanged.
- Scope/future-state/invalid-input/corrupt-evidence failure tests; focused/typecheck, one fresh read-only review, corrective RED where needed, wholeverify, status evidence/limits.
- Commit/push stacked on PR236, attachment once, exact-SHA P0; continue remaining confirmed nonvisual work without design connection or merge.

## Boundaries

Numerical calibration remains independently accepted content, not invented production balance. A workload revision pins same-day causal history; the caller supplies a reference, never the fatigue value. This slice does not itself add intra-play activity charging, initial pregame actor evidence, other action workload, autonomous full-game orchestration or injury/rehab generation.

## Execution record

- Core response, exact historical selector, frozen Native policy owner and actual physical runtime connection are implemented. Separate missing API/module REDs preceded each part.
- Actual Native accepted official physical pitch workload changes later motion/velocity/spin and actual plate arrival; accepted recovery changes future execution while old revisions reproduce original flights after recovery/reopen. Long-term histories and workload head remain unchanged by execution.
- One fresh reviewer found valid SourceVersion rewriting in two fields after COMMIT. Corrective RED reproduced it; original canonical accepted Source SHA256 digest validation fixes offline read/retry. Same-review recheck confirmed no additional findings, independent2 files/5 tests.
- Final parent affected7 files/23 tests1.34s and typecheck/catalog compilation passed. Whole `npm run verify` passed535 files/3165 tests636.34s; publication/exact-SHA P0 follow.
