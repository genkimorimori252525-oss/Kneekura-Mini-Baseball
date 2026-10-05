# Bounded physical-end replay and test witness

This slice addresses measured repeated replay work and a test-only resource-retention defect while preserving concrete owner validation. It continues the original checked pre-end fixture; it does not create a new physical outcome, extend a calibration, or assert completed physical closure.

## Scoped archive reference encoding

The private replay factory shares exact-object deeply immutable archive-reference encodings during one execution scope/derive. Public readers still start fresh factories, including initial proposal, pretransaction/current checks, transaction checks, post-insert admission, saved read and immutable retry. SQL statements, bindings, raw rows, metadata/head checks, archive bytes/hash comparisons and Core progress checks remain active. Distinct objects and role namespaces cannot borrow one another's validation.

Author commits: `70966d0e150ea089d4a742e038de7b638c6ff841`, `57985c2db5472a5e6168bb2e32bf84c05022936c`, `604fd0f9d75a77205143e1c10550a8cde8daad42`.

- Pure tests: 56/56 passed; full typecheck passed before the final ten test-only assertions
- Final candidate: independent baseline/candidate SQL parity passed 1/1, with 3,270 identical ordered prepare/method/binding entries and matching canonical bytes, in 8.62 seconds process time
- Final candidate: real disk/WAL suite passed 4/4 in 65.42 seconds process time. It covers fresh phase/retry factories, warmed-cache writer-local predecessor/head corruption rollback followed by healthy recovery, committed peer mutation, and pinned snapshot visibility
- Source/input hashes were unchanged. Both processes exited 0 and were reaped. Actual fork receipts showed a 1,120 MiB total V8 heap limit from a 1,024 MiB old-space setting. Sampled peak RSS was 588 MiB for dual-tree parity and 287 MiB for the four-case gate
- Independent static review found no blocking defect; both initial coverage notes were closed

The parity read rederived the three-row prefix while authenticating all nineteen metadata rows of the checked seventeen-piece backup. It is not a forty-piece construction result. No end-to-end speedup is established by these component and boundary tests.

## Scoped metadata statement preparation

A separate read-only original-end diagnostic on `bf8233fa` stopped at its explicit 180-second wall bound after 256,720 prepares, before completing rule consumption. Scope replay took 48.27 seconds; decision rereads took 69.09 seconds. Peak worker RSS was approximately 297 MiB and sampled heap usage remained bounded. Source, original input and disposable copy hashes stayed unchanged. This interrupted diagnostic was not a PlayEnd acceptance.

Author commit `6dfff04cba50139a109882b54717a375c9f1c7aa` now reuses only prepared metadata statements by exact SQL during one synchronous PlayEnd derive. Every get/all executes with its current raw document. No SQL result, row, JSON projection, validation success or evidence is cached. Raw-row/head queries are unchanged; the original connection object remains the dependency-context identity. Nested derives get a fresh scope and restore the outer scope. A statement is removed from the pool while executing, and all references are cleared in finally.

TDD first demonstrated redundant preparation in the existing PlayEnd projection. The final 14 tiny and 16 adjacent cases passed with verified worker caps and unchanged source hashes. Coverage includes different bindings, preserved duplicate/escaped metadata and legacy raw bytes, real WAL visibility after commit, schema drop/recreate, same-connection mutation after a hit, reentrancy, exceptions and independent calls. Two independent static reviews found no blocking issue. An intermediate test expected the wrong error-message word; the original rejection behavior was preserved and the assertion was corrected.

## Preserved continuation and witness

The reviewed continuation reuses the original `scheduled-decision-home-2` at its accepted rule cut instead of adding another defender. It removes only the exact known trap from a disposable copy, rejecting unknown definitions. The launcher must pin the checked input hash and original empty/absent WAL, and verify source/input invariance before and after execution. Neither the manifest nor stored rows substitute for normal owner validation.

The previous write-witness helper used a global Vitest spy on `DatabaseSync.prepare`. A targeted RED demonstrated that its result history strongly retained 256 unrelated native statements. Two additional REDs demonstrated cleanup overwriting later interceptors. Plain descriptor interception replaces the spy, retaining only target-statement restoration callbacks and the witness boolean. The observation still runs only after the real INSERT and its triggers return; thrown SQL and observation errors are preserved. Later interceptors are not silently overwritten.

The first correction passed 72 cases across the witness, actual post-INSERT rollback, fence, runtime and registration suites. Two follow-on RED cases exposed dropped native prepare options; variadic forwarding then passed the final 74/74 gate. Independent static review cleared the complete correction (`cc48f10` + `814b412`). Source hashes were unchanged, the process was reaped with exit 0, all observed forks had the verified heap limit, and peak RSS was approximately 146 MiB. The previous large run's kernel termination cause remains unconfirmed; the demonstrated retention defect is specific and separately reproducible.

## Exact integrated gate

Immutable local `486708773c5092408e99d82b82d6ef22e6ff6b39`, full tree `4b71b148ab09ddc48b06ef7aa4f2bd471e432a13`, source tree `4291d9095e714ba7de86ef5ee974f40312b43df4` passed catalog generation, complete TypeScript checking and **17 files / 170 tests, zero skips**. The gate ran 2026-10-05 00:06:48–00:08:22 UTC and was reaped with exit 0. All 2,058 tracked hashes were unchanged; manifest SHA256 `0e4b9def5a955877baf3f5488a65364ce551f75254a0f0f45e44b1caba86a55f`.

The compiler used a direct 1,408 MiB old-space setting and completed in 22.97 seconds. The bounded test stage took 70.78 seconds including startup; every observed fork had the verified 1,120 MiB total V8 limit. Sampled peak RSS was 1,275 MiB for the compiler and 267 MiB for a test worker. No wall/RSS guard fired and no owned process remained. The test selection combines the three independently reviewed corrections and preserved-artifact guards. Publication's subsequent documentation-only update retains the same executable source tree.

## Remaining acceptance

The checked pre-end fixture has no physical-end/seal record. The next gate must exercise the real negative seal-INSERT witness, rollback, clean actual end admission, preservation of original physical/information rows, complete close/reopen and retry, then emit a checked closed backup. Official closure, all-role workload, the next real pitch, the forty-piece archive and current cumulative whole suite remain separate unfinished gates. This slice does not claim any of those results.
