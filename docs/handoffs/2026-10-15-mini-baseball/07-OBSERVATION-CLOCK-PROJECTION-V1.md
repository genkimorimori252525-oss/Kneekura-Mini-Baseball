# Observation clock projection V1

## Purpose and authority

The genuine V3 metadata experiment reached the existing observation clock guard:
the original nominal and effective observation calibrations use 1000 ticks/s,
whereas the original V3 field uses 1000000 ticks/s. The failed admission added no
metadata row and changed none of the 850 SQL rows / 108 table schemas. Its closed
DB, Map and unadmitted proposal remain under
`work/native-v3-metadata-proof/failed-clock-checkpoint` outside this repository.

This change expresses a unit conversion, not an ability improvement or measured
player calibration. Existing model Sources, their baseline/rebinding rules,
accepted rows/hashes and legacy calibration forms remain unchanged. No DDL.

## Contract and implementation order

1. Add a pure `projectObservationClockV1(calibration, targetTicksPerSecond)`.
   Scale only attended/peripheral refresh tick intervals by the exact rational
   target/original clock ratio; change memory ticks/s to the target. Use integer
   arithmetic and reject non-integral or unsafe results. Preserve every SI or
   dimensionless value, including confidence loss per second and observation
   duration seconds. Do not convert any stored observation timestamp.
2. A reserved new lifecycle calibration Source version adds the explicit
   `observationClockProjection` references: original nominal model, original
   effective calibration, and the current original physical field. Only
   `defender_observation` accepts this contract.
3. The Native lifecycle owner independently rereads the nominal model, original
   calibration and field through their existing original owners. Require exact
   reference/hash/lineage/player/view binding, a supported free V3 field, and
   equal original nominal/effective clock rates. The target clock is the owned
   field's rate. Project both nominal and effective inputs with the same pure
   function, require exact equality with the declared effective response, and
   record the projected nominal input hash plus explicit conversion evidence.
   A caller response alone cannot change the clock. Chained projections remain
   unsupported in this first contract.
4. Keep legacy source/result JSON byte shapes when the new field is omitted.
   Run RED tests before implementation, relevant regressions and whole tsc.
5. Start a separate branch from the immutable V3 field snapshot. Never overwrite
   the failed branch. At each successful original-owner stage, close all handles,
   save a consistent standalone SQLite backup plus Source Map/hash manifest, then
   continue. Re-run genuine lifecycle/32-calibration admission as necessary.
   Finally admit one observation and cold-reopen it in another process. Keep
   original field/moment/side/solver evidence/archived rows unchanged; the original
   operation owner's precisely expected head CAS is separate from body movement.

## Verification

Pure tests compare same-seconds attended/peripheral refresh deadlines, memory
prediction/decay/floor, quality and captured SI estimates at both clocks. Reject
unsafe integers, inexact conversion and malformed inputs. Owner tests reject
forged original model/calibration/field references, different original clocks,
effective-only edits, unsupported field scope, stale/foreign bindings and chains.
Legacy source/result shapes and original clock guards remain covered.

## Unresolved work retained

The new contract covers exactly the three clock-dependent observation fields.
Decision delay/first-step tick durations, locomotion integration-step ticks,
communication propagation/recognition tick delays, throw transfer ticks and other
route clocks need separately owned contracts before their future integration.
There is no TTL field in `PlayerObservationCalibration`; existing historical
receipt ticks are immutable and are not relabelled at a different clock.

Native metadata success remains pending until the new Source is admitted and
cold-reopened. This work grants no nine-body movement, custody, throw, runner,
rules, official result or complete-game credit. V3's stationary-body/free-action
constraints and the remaining rules guard are retained. MMD is not a future
calibration basis; this clock projection is independent of motion reference data.
