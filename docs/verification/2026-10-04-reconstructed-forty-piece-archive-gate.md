# Reconstructed forty-piece archive gate

The original forty-piece construction test and its579 artifact were lost during
executor replacement. This test is a new reconstruction from the unchanged
original32 Integrity fixture; it does not restore or attest to those lost bytes.
The original32 test remains unchanged and is pinned by its SHA256.

`ActualLivePlayFortyPieceConstructionNative.test.ts` uses the current real
`ownedScheduledMotionFixture` with capture power1000 and the original nominal
contact time0.01. It accepts the plan, zero-time constraint initialization, forty
positive retained capture checkpoints, actual secure and confirmation steps,
whole-play history and an actual observation. All ten original participants and
their fifty primitive roles remain present. There are forty named retained rows,
forty-three owned physical steps and forty-five total physical rows.

Each new Source references the immediately preceding accepted composition's
retained commands, with its actual executed-through moment. The writer still
reconstructs and authenticates every original self and command. No derived
receipt is supplied as authority, and no prefix is cached across operations.

The test writes a consistent construction backup/report before adding fault
triggers. After closing every construction connection it performs one fresh
physical and observation owner read. Scope and queue then exercise witnessed
post-INSERT dependency corruption/rollback, acceptance, frozen Source retry,
manifest corruption rejection and a distinct peer WAL mutation before the
writer's BEGIN IMMEDIATE. The post-INSERT witness must see the actual inserted
row and changed physical head inside the real writer transaction before the
exception; an unrelated preflight failure cannot satisfy it.
Both forged workHash/localWorkHash snapshots receive a matching recomputed
outer snapshot_hash before read. Their rejection therefore requires fresh owner
rederivation and omitted-record identity checks, not just a stale outer hash.

After restoring deliberate mutations, every archive connection closes. Fresh
disk connections rederive both complete logical outputs and compare every
original row and accepted archive byte/hash. The fixture does not raise inert
limits; the forty-piece queue must still fail the generic actorJson budget.
Scope logical node/byte size is recorded without claiming forty crosses the
scope's original budget.

## Artifact contract

The fresh explicit output directory receives four new files:

- `actual-live-forty-piece-construction.sqlite` and `.json`, format
  `actual_live_forty_piece_construction_v1`, written before faults
- `actual-live-forty-piece-archives.sqlite` and `.json`, format
  `actual_live_forty_piece_archives_v1`, written after fault checks and full reopen

Both reports bind the actual tested commit, full/source manifest hashes,
runtime, original fixture hash, database hash, original table/row hashes,
physical/observation Source IDs and owner-validated logical hashes. The final
report adds scope/queue pairs, original-row equality, both fault witnesses and
close/reopen results. These are test receipts. An artifact consumer must verify
the database bytes and reconstruct its concrete original owners; stored raw
snapshots or report values are never substitute authorities.

## Coordinated execution

Ordinary light gates leave this expensive test explicitly skipped. A scheduled
wrapper must set `BASEBALL_FORTY_NATIVE=1`, a fresh empty
`BASEBALL_FORTY_ARTIFACT_DIR`, `BASEBALL_FORTY_SOURCE_COMMIT`,
`BASEBALL_FORTY_FULL_SOURCE_SHA256` and `BASEBALL_FORTY_SRC_SOURCE_SHA256`.
The wrapper must verify those exact checkout/manifests before and after the run,
use Node26, one worker, the coordinated Native lock, a1GiB heap and disk TMPDIR,
and require exactly one executed PASS with no skip. No launch is implied by
this code checkpoint.

`BASEBALL_FORTY_PHASE_LOG` belongs outside the artifact directory. It records
UTC, monotonic elapsed time, checkpoint index/revision, actual physical elapsed
time and bounded operation timings. `OWNED_SCHEDULED_TIMING_PATH` may retain
the existing fixture phase hook. The construction database/hash milestone is
emitted before faults so a later interrupted tail is explicitly distinguishable
from a completed archive gate. Avoid extra unchanged replays for progress.

The Native reconstruction and its current-source artifact remain unrun until
the coordinator schedules the frozen source. Light/type passes alone are not
forty-piece Native acceptance.
