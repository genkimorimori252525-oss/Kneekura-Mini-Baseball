# Revalidated field-normalization recovery slice

Verified source: local `b3afd6037bf588f56f043ad6a39c53bcab8e9f30`, remote `c153962a1f4b8fcc5d46333f781362ee197ca30b`; full tree `8cac17bc1475733bada920cde7041e35678366ad`, source tree `a4c6faf1ed46bcc16f4d9ab17f310390b50112dd`. Published in [Draft PR #286](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/286).

This is a fresh application of the preserved two-function optimization to durable PR #285. It is not recovery of the complete unavailable later integration. This documentation addition is subsequent to the verified full tree and does not relabel that test run.

## Preserved behavior

- Segment-local maps use the unchanged canonical inert actor key; iteration order, uniqueness, membership, cardinality, radius, horizon, retained equality and continuity checks remain
- Field scope validates and rederives each row on each call, serializes Source/snapshot once, and hashes exactly those canonical bytes
- Generic serialization budgets and invalid-input checks are unchanged; no cross-operation cache is introduced
- The deterministic synthetic 50-part fixture retains the original output hashes while identity normalization calls fall from 5,350 to 200; Source clones fall from 3 to 2 and snapshot clones from 2 to 1
- These are measured operation counts, not a Native timing speedup or full-game performance claim

## Fresh execution

Node 26.10.0; one test worker; 1,024 MiB test heap and 1,408 MiB typecheck heap.

1. RED: exactly two expected normalization-count failures, with 26 other tests passing
2. GREEN: all 28 focused normalization tests passed
3. Catalog generation and complete TypeScript typecheck passed
4. Ten adjacent files / **76 tests passed**, including those same 28 focused cases; test duration 702.57 seconds, exit 0
5. All **1,869 tracked-file hashes** remained unchanged; manifest SHA256 `743e89039e3ce9b5dc5847dae08f8ccd0366a1d17e117e5686d4b323b67d5bb6`

The ten files are the following `src/host/world/` tests:

- BattedWorldFieldNormalization.test.ts
- BattedWorldFieldPhysicalPrefix.test.ts
- BattedWorldFieldPersistentContact.test.ts
- AtomicFieldAcquisitionConstraint.test.ts
- BattedWorldMotionCheckpoints.test.ts
- BattedWorldReleaseCustodyCompatibility.test.ts
- ScheduledFieldAcquisitionConstraint.test.ts
- ScheduledFieldAcquisitionHistory.test.ts
- ScheduledFieldAcquisitionRace.test.ts
- ScheduledFieldThrowHistory.test.ts

The adjacent fixtures exercise actual legacy Native custody, capture, throw, history and mutation/reopen behavior. The focused normalization fixture is explicitly synthetic and its tiny SQLite scope is not original-pitch Native admission. The entire ten-file run is not described as a new all-disk/WAL fixture proof.

The original optimization hunk had independent review before the environment interruption. Its behavior was reapplied and tested here on the durable baseline; the full unavailable original source is not asserted byte-identical.

## Remaining boundaries

The interrupted v2 physical-end and forty-piece archive gates still lack terminal acceptance. Actual official application, ten-role workload and real next-pitch acceptance on a recovered coherent v2 source remain outstanding. Current cumulative whole verification is unrun. The last recorded whole pass remains exact PR #277 and cannot certify this source.

The GitHub Actions lookup for exact remote `c153962` returned zero workflow runs at 19:46 UTC. No workflow, package, lockfile, configuration, visual/UI, merge or deployment change was made.
