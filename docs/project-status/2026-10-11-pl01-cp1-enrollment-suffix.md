# PL01-R3: remaining occupied enrollment from corrected-run cp1

The existing exact retained entry now accepts only cp1 from the corrected
PL01-R2 run. This advances the completed boundary by one returned owner call;
it adds no checkpoint selector or alternate fixture. The original fresh PL
callback and shared occupied helper remain byte-identical.

## Actual boundary and attribution

The [cp173 contract](2026-10-10-pl01-retained-terminal-suffix.md) remains linked
explicitly to published `d6dfd095dd6c59fd195484394d1be21e0705dfdc`. That run
completed the original ten-person settlement, transition, release, terminal
retry/reopen assertions, next actor, and next body/batting/runner model owners
before its baseline call reached the wall cap.

The [cp8 history](2026-10-11-pl01-cp8-occupied-suffix.md) records both later
failures separately: `fd0846a5` rejected new-batter initialization without a
committed checkpoint; corrected `e6de9bb3` returned that initialization and then
failed the eleven-participant enrollment guard. Neither run established an
occupied pitch or a whole-suffix PASS. The released-claim production correction
is being prepared separately for the combined review and qualification.

The new exact input is the snapshot immediately after the corrected run's
`PlayerWorkloadRecovery.initialize` returned for
`physical-fixture:occupied-next:new-batter-baseline`:

- Source commit: `e6de9bb39dda0df4412824f450189d65f8148a5d`
- Source tree: `9945219b1e94a0fda85cb2923194f5b77657c45e`
- Gzip: 533,350 bytes; SHA-256
  `f4fce41798801429767a0b9cd07ed86001644f18740f521bc7b6f1148c979cd8`
- SQLite: 8,171,520 bytes; SHA-256
  `49685af2fe6f3277b4f6488af35140a54ceb79a8dc9774cff74fda9973049bcc`
- Historical receipt SHA-256:
  `27c4a93807851408d068f3842c62bfb117b3103efc7b5c327472b19cb10bc05b`
- Returned baseline-state SHA-256:
  `d6bc633fc32ab888e6b2fe3faf1c2275fdf4ffcc872b09d358a0f73e8b1a78ac`

The snapshot has 108 tables, twelve baselines and heads, eleven existing
activities, one historical enrollment and zero reservations. The new away-2
baseline/head is revision zero with no activities; the occupied enrollment and
runner-hold table are absent.

## Authentication and remaining work

The adapter preserves all earlier terminal, actor, body, batting and runner
authentication. It reconstructs the expected new-batter baseline Source using
the original authenticated fixture baseline and next actor's binding, exactly
as the shared helper did. It compares the stored Source, accepted Person, and
the initial state with `readActualRoleWorkloadState`'s policy/history/head replay,
requires revision zero and the observed returned-state digest, and requires
the original enrollment-only boundary.

The unchanged `continueSamePaOccupiedWalkFromBaselineFixture` then sees the
existing baseline and skips its initialization. Its first writer is the original
eleven-participant enrollment. All 26 remaining assertion expressions and their
order remain intact through prefix/TOTAL/view, runner hold, 32 calibrations,
occupied TAKE, workload/official-state checks and retry/reopen. No baseline
write, six-TAKE prefix or completed terminal section is repeated.

The result uses `pl01_cp1_enrollment_suffix_result_v1`, explicitly identifies the
completed baseline and absent occupied enrollment, and always sets
`wholeCasePass: false`. Prior cp173/cp8 contract commits and database hashes are
separate fields; changing the current source pin cannot relabel the cp173
contract. Earlier completed assertions remain historical evidence only.

## Input and author checks

The input still has exactly `nativeReleased: true`, a canonical absolute
`checkpointGzip` path and a fresh `destinationDirectory` under an existing
canonical parent. Exact compressed/raw hashes and sizes are verified before
exclusive creation. A restored gzip alone suffices. Historical control,
receipt and terminal digests remain provenance; all three private witnesses
are explicitly marked not rechecked, and none is required or synthesized.

Author checks with the pinned Node 26 runtime:

- Five finite input/provenance tests passed.
- A capped file-only materializer check accepted the exact cp1 without private
  witnesses and rejected reuse of its destination.
- On one owned immutable inspection copy, the production read-only workload
  projection authenticated the original and new-batter baselines, matched the
  observed returned-state digest and rejected a wrong Person. The bytes stayed
  unchanged; no production writer or full continuation ran.
- SQLite integrity, size/hash and cheap boundary census checks passed.
- Syntax parsing passed for all four changed TypeScript files. The original
  shared occupied helper, fresh PL callback and terminal assertion helper were
  byte-identical to the base.

The integrated27-file batch then passed independent review, full compiler
(32.590 seconds) and24 selected checks (64.617 seconds). Exact source and report
attribution are in the [combined qualification](2026-10-10-terminal-proof-recovery.md#fresh-enrollment-claims-and-exact-pllan-continuation-batch).
Genuine continuation remains unexecuted; no suffix PASS is established.
