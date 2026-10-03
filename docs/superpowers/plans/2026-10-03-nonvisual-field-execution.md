# Actual field acquisition, custody and throw implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. Preserve the original causal evidence and keep Presentation disconnected.

**Goal:** Continue the approved remaining nonvisual plan by making the original field owner support actual capture, carried movement, transfer and released throws with the same explicit base geometry.

**Architecture:** Keep PR259's immutable field-action archives unchanged. Add field-aware Core acquisition/throw functions and an additive Native field-execution prefix rooted at the latest original field action. The new owner prevents fresh lower-owner motion while historical readers/retries stay valid. Every result is rederived from original geometry, Player/Person and physical history.

**Tech Stack:** TypeScript, Node SQLite, Vitest; existing locked dependencies.

**Spec:** `docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md` §5 item2 and `docs/game-design/05-world-first-live-ball-architecture.md`, `06-world-first-runtime-contracts.md`, `07-world-first-adjudication-contracts.md`. Authoritative Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d / Realism4f0a60a3818926327b6bf5877ab3dec456a76530 rechecked remotely. Base PR259 ad296f7e7e1349bc4b114d95a7ca078a5994eecb.

## Global constraints

- This executes the user's request to resume the confirmed remaining plan; no new product design or guessed production calibration.
- Preserve legacy archive shape/hash/replay and exact Player/Person/fixture ownership.
- A bag, actor, ground or venue contact during capture/transfer interrupts custody; no fabricated release, catch, OUT/SAFE, playEnd or official closure.
- Native adoption owns a contiguous immutable prefix, metadata/head/source/hash/mirror integrity, current-write fences and rollback; historical proof does not replay future payloads.
- No home-computer or self-hosted CI dispatch, workflow/config/lock changes, merges, force pushes, UI/art/Presentation work, generated catalog or scratch evidence staging.

## Review focus

- A base prism contact during the securing interval or transfer must interrupt possession without passing through geometry.
- A corrupt or hidden Source/head must not permit a competing physical owner or a prefix restart.
- Reading an earlier valid snapshot must not consume a future action payload, but must reject broken future sequence metadata.
- A late WAL mutation of original Player/Person/geometry/Source or current workload must roll back action and head atomically.
- Historical archives must remain valid after later legitimate recovery; fresh writes must fail currentness checks.

## Tasks

### 1. Field-aware Core acquisition and throw

Files: `src/core/sim/ball/BattedWorldFieldAcquisition.ts`, `BattedWorldFieldThrow.ts` and focused tests; shared pure retention/transfer helpers only when needed to preserve legacy behavior.

- [x] Write and observe RED tests for bag interruption during actual capture, same-tick deadline, carried transfer and released flight
- [x] Implement field-aware actual acquisition and throw, retaining explicit base-contact provenance and all physical competitors
- [x] Run focused new/legacy Core tests and typecheck; validate no legacy archive behavior change

### 2. Native field-execution ownership

Files: `src/host/world/SqliteBattedWorldFieldExecutionStore.ts`, `BattedWorldFieldExecutionFixtures.test-support.ts`, `SqliteBattedWorldFieldExecutionStore.test.ts`, `BattedWorldFieldExecutionWal.test.ts`; narrow fresh-write guard in `SqliteBattedWorldFieldStore.ts` and `BattedWorldMotionOwnershipFence.ts`.

Interface: `AcceptedBattedWorldFieldExecution` contains immutable `sourceId/sourceVersion/baseFieldSourceId/previousExecutionSourceId/action`. Actions are acquisition, motion (accepted tick horizon/full actor commands) and throw (same motion plus original fielding model and active receiver). Durable snapshots retain the original field root, ordered Source history, and actual field/acquisition/throw results.

- [x] Write and observe RED Native adoption/reopen/continued movement tests
- [x] Implement own-connection derivation, bounded historical replay, complete metadata validation and single-owner fencing
- [x] Observe unsupported acquisition/transfer and lower-owner continuation RED, then GREEN; add regression coverage for injection, stale append, corrupted metadata/source/hash/mirror, hidden owner and late WAL mutation
- [x] Run focused Native/legacy/WAL gates and typecheck

### 3. Verify and publish the exact dependency

- [ ] Complete independent frozen PR259 baseline verification and distinguish its terminal outcome from new Source
- [x] Fresh read-only review of the full dependency; reproduce material findings RED and fix GREEN
- [ ] Freeze new Source, run aggregate verify, record exact runtime/source tree/terminal receipt
- [ ] Publish isolated stacked draft PR above #259 and verify remote SHA; no self-hosted dispatch
- [ ] Record honest completed boundary and the next dependencies: field rule histories/race, legal/official closure, next play, general actors and autonomous Career

## Pre-flight

Core acquisition and throw supply pure field-aware results to Native. Native keeps the original field geometry and current Player/Person owner; callers cannot pass outcomes or replacement World state. Existing PR259 field archives remain structurally untouched. All unfinished original-plan domains remain unfinished until their own implementation and evidence exist.
