# Completed physical prefix reuse in one Native read frame

The retained National actor read repeatedly authenticated the same completed three-action foul prefix within identical owned physical read frames. The paired reader now retains only its fully successful frozen result in that existing frame. The prefix-only reader uses the same owner route inside a frame and still returns its own array. Independent and nested frames authenticate afresh.

Every access still reads and checks the endpoint, current head, complete revision metadata and original payload rows twice. Hits compare those identities with the completed proof. The existing transaction, query-only and dependency stamp check runs before and after; the owning bracket still verifies its private savepoint. Namespace changes expire the proof, attached owners retain fresh replay, and caught failures poison reuse, including a failure caught during authentication before the outer proof completes. No current-progress or mutable writer phase is cached.

## Bounded retained-operation evidence

The unchanged operation was `withBattedVenueLegalReadSnapshot(db, () => readPhysicalPlateAppearanceActorFromSqlite(db, 'national-live:batter'))`, run read-only against consistent identical SQLite snapshots. The original running/stopped database and private diagnostics were not changed or published.

Both runs deliberately stopped at 45 seconds inside the single prior-foul completion read. Neither returned the requested actor, so this is not a successful National continuation or a measured end-to-end speedup.

| Observation before the stop | Baseline | Candidate |
| --- | ---: | ---: |
| Completed prefix/paired API reads | 374 | 409 |
| Distinct successful frame/source pairs | 112 | 121 |
| Actual prefix replays, witnessed by original actor-scope SQL | 374 | 121 |
| Actor-owner identity queries | 749 | 243 |
| SQL prepares | 100,159 | 78,005 |
| Sampled cumulative prefix replay time | 18.638 s | 15.953 s |

The baseline uses runtime commit `7d2babe50a0d67f99d39f36430eba92933f83231`, source tree `494a19790a4e28d7e61c43c795814240a35ff922`. Both affected production files are identical at the branch base `f519bd8eec41fc17c69e9eb463f553b515008540`. The measured candidate source tree is `99354eda0abeba955426e2207a65162cc878acbc`; final code adds one pre-install caught-failure check and its regression after that measurement. No second performance run is claimed for that hardening.

The SQLite file SHA-256 before and after both operations is `bf9808bf49485f745efcb68cc1af940275108c1018f67f9ad5bdcf56878aa247`. The candidate diagnostic worker flushed its profile and exited normally; its harness completion does not count as completion of the actor read.

Remaining sampled cost includes inert cloning, actor canonical serialization, original foul metadata and roster serialization. The remaining 121 successful replays use different child frames in the same enclosing operation. This change deliberately preserves their existing independent authentication.

## Affected verification

- Six new controls cover same-frame reuse, raw audits, child/independent freshness, array isolation, caught failures before and during authentication, write-and-restore, namespace changes, missing results and rollback/rebegin.
- Six existing paired cleanup/error-envelope cases and the existing real postwrite freshness case pass on the final code.
- The existing paired-pitch file has 17 passing cases and one existing failure. Its prepare-only adapter case fails identically on unchanged `f519bd8`: `corrupt original physical pitch prefix`, caused by `National Match evidence requires a Native connection`. Native validation precedes any absent-owner SQL. The assertion and Native authority remain unchanged; the affected selection is not wholly green.
- Catalog generation, TypeScript and all 18 protected blobs are checked separately. No full fixture, full scenario or home-PC CI is run.

The subsequent integrated batch fixes the pre-existing ordinary Club adapter
compatibility gap while keeping National evidence Native-only, including
case-alias table/view guards. All selected cases pass in the documented
[combined qualification](../project-status/2026-10-09-occupied-motion-attribution-batch.md#controlled-body-tags-persisted-recruitment-and-original-proof-reuse).
The diagnostic timing/count boundary above remains unchanged.
