# Physical first-pitch proof reuse — 2026-10-09

The physical action reader replayed the completed first TAKE directly after
its lifecycle basis had already authenticated that same pitch. Each redundant
replay reconstructed the original dispatch calibration set and repeated its
assessment ownership queries.

The reader now calls the existing continuation original-pitch reader. Only the
completed, frozen historical result is reused inside the enclosing Native
query-only proof. The exact stored Source and snapshot hashes still form the
reference. Current lifecycle admission, nominal model selection, and all
pre-effect, post-effect, retry and committed verification phases retain their
independent checks. No cache, scope, transaction policy or mutable-operation
behavior was added.

## Saved actual operation

The comparison starts from integrated commit
`6e6bd49b51e50ac04b6b802b9204fd5a54abafe6` (source tree
`f2c9dda8eab8d596b9af8b2b4354015d0942f982`). It uses separate, initially
identical consistent SQLite backups of the retained genuine Native state after
the third launch and before the first physical capture cut. No fixture was
rebuilt. Each worker had a 100-second diagnostic stop and a 115-second outer
cap; both exited normally and flushed their own CPU profile.

| Initial capture-cut operation | Integrated baseline | Reused original pitch |
| --- | ---: | ---: |
| Return after committed verification | 53,276.96 ms | 30,031.08 ms |
| SQLite prepares | 365,342 | 232,430 |
| Cut INSERT returned | 19,141.37 ms | 10,751.89 ms |
| Head UPDATE returned | 26,922.31 ms | 15,319.26 ms |
| Declared writes | 2 | 2 |

Elapsed operation time fell 43.6%; prepares fell 36.4%. Both returned and stored
the same cut and head hash,
`50039c3d1bccc4bdcb16e7169ed9cc231f09ade5dfd92ac974db03c9e9857522`.
The complete persisted table/schema contents also matched between the two
resulting copies. The earlier 48.94-second capture-cut observation on the body
reuse candidate remains a separate measurement, not this comparison baseline.

Worker samples localize the reduction: cumulative first-TAKE replay fell from
26.01 to 5.80 seconds and dispatch calibration input authentication from 13.84
to 2.52 seconds. These call stacks overlap and must not be added. The remaining
second-TAKE historical replay costs 18.88 seconds cumulatively; it is not
changed by this patch. Private databases, diagnostic tests, receipts and
profiles remain outside the repository.

## Verification

- `SamePlateAppearanceContinuationPitchRead.test.ts`: 2/2 passed. Real Native
  lifetime controls cover full-reference mismatch, separate connections and
  phases, caught failure, DML, schema mutation, transaction replacement and
  cycles. This light test substitutes the expensive dispatch replay; the saved
  actual operation above independently exercises authentic stored owners.
- Full TypeScript check and catalog compilation passed.
- All 18 protected blobs remain exact; `git diff --check` passed.

This evidence covers the saved initial capture cut and the affected proof
scope. It does not qualify the remaining IFN scenario or any full Native gate.
