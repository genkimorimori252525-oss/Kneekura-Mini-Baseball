# Native body archive reuse within one proof

Base production source: `961f82251af828ce04b6eda334244761883603ec`.

A consistent SQLite read-only backup of the running in-flight fixture retained
both real TAKEs, the complete lifecycle view/calibrations, and the accepted
third-pitch posture. The live database and its WAL were not changed. Profiling
one authenticated posture read inside the same physical/lifecycle brackets used
by the owner took 9.50 seconds. Body materialization replay accounted for 5.75
seconds of cumulative sampled time, largely through repeated batting-model
parameter-pin authentication while replaying the second TAKE setup.

The body evidence reader now reuses the completed, frozen archive inside the
existing immutable continuation phase. The first read still authenticates its
original Person, parameters, fielding/release dependencies, metadata and hashes.
Every access validates the identity and main/TEMP/attached-owner restrictions.
Caught errors invalidate the enclosing proof. Writes, non-query-only readers,
non-Native facades and independent proofs retain fresh authentication. No
accepted Source, archive shape, body selection rule or transaction boundary
changes.

## Same-snapshot comparison

Node 26.10.0 / Vitest 2.1.9. Separate workers used static imports of the baseline
and final candidate, the same saved Native database, and the same owned proof
brackets. No fixture reconstruction was needed.

| One authenticated posture read | Baseline | Changed |
| --- | ---: | ---: |
| Wall time | 11,284.40 ms | 4,309.55 ms |
| SQL prepares | 49,778 | 28,186 |
| Body archive identity reads | 179 | 10 |

The derived-value hashes match. An earlier separate profile measured 9,497.40
ms versus 4,683.20 ms with the same prepare counts and output hash. Wall times
are bounded diagnostic samples, not a whole-game runtime claim. Private
snapshots, profiles and detailed receipts are not part of this commit.

## Verification and limits

- The focused RED observed two archive identity reads instead of one and showed
  that a caught attached-owner error did not yet invalidate sibling evidence.
- All five new regressions and all 64 existing body materialization tests pass.
  These include fresh independent reads, original Person mutation, caught
  mutation/attachment failures, invalid identity rejection, original release
  history, changed retry inputs and real writer-local mutation rollback.
- The existing batted-model writer-local actor-receipt mutation control passes;
  its 19 sibling cases were deliberately unselected in that run.
- The initial broader batted-model file did not finish within its 110-second
  bound and receives no full-file pass credit. An asynchronous dual-source
  diagnostic harness timed out during module loading; the static-import
  comparison above completed and replaces it as measurement evidence.
- Catalog verification and the full TypeScript compiler pass. All 18 protected
  blobs retain their exact original Git object hashes.

No additional full Native scenario was started by this diagnostic. The original
retained in-flight run subsequently reached its 1200.78-second cap with all four
input groups stable and no survivors. It is not a completed scenario.

## Actual capture-cut continuation on the retained state

After that capped run, a separate consistent private copy retained the original
third-pitch launch and its completed lifecycle view/calibrations. Candidate
`582cb35471ce35bca619909f471ba54c25898b4b` (source tree
`93109cc7c77216f230804e44ca295c65f1851029`) accepted the next explicit fixture
capture-cut input through the unchanged real Native physical owner. Its view
and launch references came from the original stored owners, and its declared
horizon was the original launch tick plus 50,000 ticks.

The actual operation completed and committed in 48.94 seconds. The cut INSERT
returned at 17.10 seconds and the head UPDATE at 24.71 seconds; normal post-write
and committed verification then finished. Exactly one cut row and the expected
head were persisted, with matching returned/stored snapshot hashes. The original
retained database was unchanged and still has no cut. This qualifies the actual
capture-cut operation on that candidate, not the whole IFN01 scenario.

The bounded profile recorded 365,342 prepares. Remaining cost lies chiefly in
historical TAKE replay and assessment-ownership SQL. It does not justify skipping
fresh admission, mutation or committed-state checks. The database, WAL, profile
and detailed receipt remain private.

- Capture-cut diagnostic receipt SHA-256: `8e85eed0ba9541b995fc77516998fc4aa8090f13434586661d68d524b3fe1b18`
