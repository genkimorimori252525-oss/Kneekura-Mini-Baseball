# Enrollment claim census reuse

Base: `78427b0a7aa90180824007876d27eb4f17a7c8c3`.

A bounded 60-second inspector profile in the actual Vitest worker recorded
573,568 SQL prepares during genuine Native fixture construction. Enrollment
derivation accounted for 46.46 seconds of cumulative sampled time; provisional
claim inspection accounted for 25.70 seconds and dispatch claim inspection for
15.08 seconds. These times overlap. Participant reservation and charge fences
repeatedly authenticated the same census within one immutable read.

The enrollment derivation now uses the existing continuation read phase. The
provisional and dispatch guards reuse only completed, frozen structural
censuses inside that phase. Their scope predicates, current admission checks,
actor/workload derivation, accepted Source callbacks, and owner transaction
boundaries remain in place. Every independent proof, post-effect proof,
committed verification and retry authenticates again. Non-Native and
non-query-only readers keep their uncached behavior. The existing phase owns
signature checks, failure invalidation and its savepoint; no new durable format
or cross-operation cache is introduced.

## Bounded measurement

Node 26.10.0 / Vitest 2.1.9. A source-only synthetic fixture used the genuine
Native actor, enrollment, workload, execution and dispatch owners. After
`directNativeDispatchFixture` completed, its database was copied with SQLite
`VACUUM INTO`. The baseline and changed readers then authenticated the same
`native-enrollment` on the same persisted database, with no fixture rebuild or
mutation between measurements.

| One enrollment-basis read | Baseline | Changed | Independent changed retry |
| --- | ---: | ---: | ---: |
| Wall time | 3,982.84 ms | 348.49 ms | 313.89 ms |
| SQL prepares | 38,003 | 2,992 | 2,992 |
| Provisional census scans | 62 | 1 | 1 |
| Dispatch census scans | 31 | 1 | 1 |

All three derived-value hashes matched. This is an 11.4-fold improvement for
the measured operation, not a whole-game or full Native-path runtime claim.
An earlier separate read on the original in-memory fixture took 4,260.26 ms;
its receipt is retained separately and is not the baseline in this table.
Database, profiles and detailed diagnostic receipts remain private local
artifacts; none is included in this change.

## Verification

- The new focused RED observed 31 provisional scans where one was required.
- Three focused regressions pass: one census per independent proof; mutation
  of a real original baseline between proofs; and caught mutation inside a
  Native proof poisoning completed evidence.
- The bounded combined selection passed 11 tests across four files in 32.82
  seconds. It included all five dispatch claim guards, the existing read-phase
  lifetime test, the reached fifth TOTAL INSERT mutation/rollback test, and
  forced transaction replacement/retirement without partial-row repair.
  Nineteen unrelated TOTAL tests were deliberately unselected.
- Catalog verification and the full TypeScript compiler (`tsc --noEmit`) pass.
- The 18 protected source blobs retain their exact original Git object hashes.

The earlier hour-capped in-flight, bunt and national end-to-end runs are still
incomplete. This change does not award them completion credit.
