# Owned runner field-cut kinematics v1

## Goal and approved scope

Connect already executed runner field evidence to read-only Player kinematics at its actual immutable cut. This is the next bounded connection in [remaining-plan §5, item 7](../project-status/2026-10-04-nonvisual-implementation-checkpoint.md) and recovery priority 3. Runtime contract 06 §§2–4 and §13.1 already supplies canonical runner/controller/rebase authority; it must be reused, not reimplemented.

Preparation base: `b9ce21127f7aa7e3148d9fcaa797e45b685fa24f`. This includes the preceding [owned runner field slice](2026-10-05-owned-runner-field-v1.md), its exact-coverage repair, and the explicit legacy fixture narrowing. The field slice has a 66-case GREEN result on its repaired production source; the corrected base still requires exact-source compiler, legacy reader and Native acceptance before these dependent tests run. This document and its tests add no production capability.

## API boundary

Add a separate `readOwnedRunnerField(cut)` method to both `actualPlayerKinematicsEvidenceFromSqlite` and `SqliteActualPlayerKinematicsReader`. Keep existing `read` and `readOriginalContact` signatures, rejection behavior, results and serialization unchanged.

The exact cut is `{ kind: 'owned_runner_field_v1', physicalPitchSourceId, fieldSourceId, playerId }`. It has no caller sample time, current mode, body state, controller replacement, execution Source, result or coverage extension. Unknown fields and accessors are rejected before they are read.

The result is versioned `owned_runner_field_kinematics_v1`. Reuse the existing read-only original-contact kinematics shape for `playerId`, Person/model identity, `origin`, exact `at`, `root`, all five `roles`, declared relative pose and canonical cleanup residuals. Add:

- `authority`: the source that actually owns this Player's active motion. For the original runner it remains `physical_pitch_progress_actions`, with original pitch/runner Source IDs/hashes, motion revision and original accepted coverage. The field action is not a newly issued runner command
- `execution`: `{ owner: 'batted_world_field_actions', sourceId, revision, sourceHash, snapshotHash, executedThrough }` for the selected field cut
- `physicalPrefix`: a versioned physical-only projection containing the original eleven Player/Person participants, the exact actual horizon and complete fifty-five-part execution segments
- `dependencyHashes`: separate bounded hashes for the physical prefix, original pitch, contact, model and selected field snapshot

For the batter and nine defenders, motion authority comes from the actual field action command and its accepted coverage; their roots/relative parts are advanced from the original source and actual intervening command adoptions. No active participant can silently disappear or acquire another Person's state.

No `activeCommand`, motor-adoption capability, possession/control window, base claim, fair/foul result or PlayEnd is returned. Original accepted future coverage is provenance only; it is never the executed horizon. Exact elapsed time remains distinct from the rounded event tick. A later controller rebase may use an integer canonical tick only after physical execution really reaches that tick.

## Source and test map

1. Create `src/host/world/OwnedRunnerFieldPhysicalPrefix.ts`. Consume the bounded, independently rederived `SqliteBattedWorldFieldStore` chain. Reuse `BattedWorldOriginalContactPrefix.ts` for identities and `BattedWorldOriginalActorKinematics.ts` for original root/pose authority. Preserve every actual field segment and original geometry; do not route through the legacy rule-bearing `BattedWorldFieldPhysicalPrefix` or accept field executions.
2. Create `src/host/world/ActualPlayerKinematicsFromOwnedRunnerField.ts`. Reuse existing root/pose sampling and residual reconciliation from `ActualPlayerKinematicsFromOriginalContact.ts` / `ActualPlayerKinematicsFromPrefix.ts`. Sample actual segment endpoints, including fractional time. Any shared helper extraction must preserve legacy bytes and must not introduce a second motion executor.
3. Extend `src/host/world/SqliteActualPlayerKinematicsReader.ts` with the dedicated method. Read only the requested immutable field prefix on the reader's transaction/connection; authenticate source/head/geometry/snapshot identity and current metadata without interpreting future payloads. Public reads open the existing DB read-only and create no schema, receipt, command or state mutation.
4. Tests: `OwnedRunnerFieldKinematics.test.ts`, `OwnedRunnerFieldKinematicsReader.test.ts`, and their test-only contracts/fixture helper. Reuse the small `OwnedRunnerFieldFixtures.test-support.ts` and existing source builders. Upstream response/geometry mocks in these small tests are explicit; they are not Native ownership proof.
5. `OwnedRunnerFieldKinematicsNative.test.ts` extends the single registered `npb-2026` fixture from `OwnedRunnerFieldNativeFixtures.test-support.ts`, rather than rebuilding the whole legal chain per negative case. Read runner state after real field execution, verify current exact time/authority and unchanged official Match, then exercise readonly reopen/retry and genuine upstream tamper rejection.

## Test-first acceptance

- [x] Establish the preceding field slice's exact-source compiler, legacy reader and Native acceptance before running these dependent tests
- [x] Observe the new method's absence as the initial API RED; do not call source-only authored tests a pass
- [ ] Read all eleven active identities and five parts each at a common actual field cut, including changed defender commands
- [ ] Prove runner controller authority remains distinct from the executing field row and from its declared future coverage
- [ ] Preserve original root/relative decomposition, nonzero cleanup residuals and exact fractional collision time
- [ ] Reject arbitrary caller time/current mode/state/result/extra execution fields and accessor-bearing input
- [ ] Reject wrong Player/pitch/cut, rehashed source/snapshot/geometry corruption and metadata gaps
- [ ] Keep earlier cuts stable after a later opaque payload while rejecting corrupt future ownership metadata
- [ ] Prove public readonly reopen/repeat leaves data/schema and official state unchanged
- [ ] Keep old ten-player readers, original-contact reader and rule/custody/Scope/closure fences intact
- [ ] Independently review, then verify exact-source types and focused/regression/Native results under measured resource limits

## Remaining after this seam

This observation contract does not issue a runner decision or renew a controller. The next owner can consume the real integer field cut and existing `RunnerLocomotionController` basis/revision/rebase APIs; the existing authority tests remain binding. Piecewise trajectory progression, runtime registry/known-work composition, actual perception/decision, multi-runner rule relations and general Scope/closure remain separate approved outstanding connections. Existing ten-player `ActualLivePlayScope`, `OwnedScheduledMotionComposition`, observations and first-base End must not be opened by changing cardinalities alone.

## Prepared checkpoint before API RED

Authored but unrun: seven kinematics cases and nineteen input/reader/tamper cases, 26 total. The test-only interface helper requires the new method before a negative assertion is installed, so a missing method cannot produce a false rejection pass. There is no production implementation, compiler result, RED/GREEN result or Native acceptance in this checkpoint. The fixture depends on the preceding field slice, which still requires its own verification. Legacy reader suites and the real registered-profile Native extension remain later gates.

Independent source review strengthened the contract tests to require the original zero-time contact and both actual field segments, include geometry and participant bindings in the readonly snapshot, and use the existing finite reconciliation tolerance when comparing differently anchored analytic forms. The separate nonzero cleanup-root test keeps exact expectations. These changes are authored coverage, not execution evidence.

## Implementation checkpoint

The preceding field source `b9ce211` passed its exact-source compiler, existing eight-case legacy reader suite and single registered-profile Native acceptance. The dependent API RED on `6a63f8837cc174018b59535f70d6ad5af7e5e65b` then produced all 26 precise missing-reader-capability failures, zero skipped tests and zero fixture/suite/unhandled errors. It completed in 8.218 seconds with 433252 KiB peak aggregate RSS and verified 1120 MiB heaps; source/control hashes stayed unchanged and all owned processes were reaped. Its terminal receipt SHA-256 is `b6f758a1c269143fa17a2a115a2287c3b911d7bece1221ceab1f3aadd6dc4a34`.

The implementation now adds the dedicated physical prefix, endpoint kinematics projection and SQLite reader method described above. It consumes the existing authenticated field chain and original actor decomposition. The runner retains its original analytic anchor across field cuts; only the original ten players adopt their actual field commands. Existing reader methods and physical/rule/closure consumers retain their boundaries.

Independent source review found one boundary omission: the existing field kernel can produce an authenticated zero-time initial bag overlap, but the new prefix rejected equal elapsed endpoints. A genuine geometry/field regression then established the review RED on `c867972b28fe8dd6a51fd9e141fefbbcf9efe31a`: 27 cases, 26 passed and one exact zero-time prefix failure, zero skipped and zero suite/unhandled errors. It completed in 18.871 seconds with 452392 KiB peak aggregate RSS and verified 1120 MiB heaps, unchanged source/control hashes and fully reaped processes. Terminal receipt SHA-256: `1f2e80f4be05c5adfe77d41070ddd12ee93a6969b9feca3cc030f21f144d7d3c`.

The reviewed repair now permits equal elapsed endpoints while still rejecting backward time. There are 27 small source/reader cases and one bounded registered-profile Native case. GREEN, compiler and Native verification of the repaired implementation remain pending.
