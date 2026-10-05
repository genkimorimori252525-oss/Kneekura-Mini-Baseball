# Owned physical replay checkpoint

Repeated reads of the same physical execution graph made a complete end proof expensive. This change reuses only completed, authenticated immutable physical nodes within one synchronous operation on the same unchanged SQLite transaction. It retains fresh raw Source, archive, ownership, head and causal-rank checks. There is no cache across operations, transactions or write phases.

The read scope owns `query_only` and a private savepoint, checks transaction/change/schema state, restores prior settings, and clears its maps on every exit. An earlier endpoint-counter-only proposal was rejected after a transient rolled-back TEMP-schema shadow was reproduced. Read-only protection prevents that supported mutation sequence. This is not an adversarial sandbox against code deliberately toggling the private setting off and on or replacing the private SQLite API. Existing authorizers are untouched.

The same-operation umpire call/disposition pair removes one duplicate call derivation. First end acceptance also reuses its own complete post-trigger proof for fresh end-row/fence authentication, reducing four complete derives to three. Before-write and post-trigger validation remain; public historical reads and retries still derive independently. Failed setting/transaction cleanup retires the writer and preserves errors, while a failed native close can be retried.

## Fixed integrated gate

Production integration `238676a674ddafbc15257ed8081aa5c35cec88ab`, source tree `98a2a5b79e6fe0e210d774673afa70f64fe6ff59`, passed catalog compilation, full typecheck and **29 files / 236 tests**, with zero failures or skips, at 2026-10-05 03:18:35–03:19:42 UTC. All 2,077 tracked/generated hashes, runtime and controls remained unchanged. Manifest SHA-256: `7dc4ba3cecfc785c153c2f36a44c4f01157deef9fcf86a87bf2cbe2b8f96210a`. Compiler and tests used verified Node 26.10.0 heaps of 1,504 MiB and 1,120 MiB respectively. Processes were reaped without guards or stragglers.

The preceding harness attempt preserved 233 passing tests and a passing compiler but exited 1 because its expected count was wrong: it selected the nine-case `OwnedPhysicalReadReuse` while budgeting the three-case `BattedWorldFieldExecutionReadPair`. The corrected gate includes both files and is the accepted result. Its original failed count receipt and controls were retained unchanged.

The isolated source reviews found no blocker after the reproduced guard/cleanup corrections. Tiny tests establish the operation boundary; they do not substitute for real physical rederivation.

## Genuine cold-read equivalence

Test-only source `7a6db1cb1c423da7f8cac254e7919b6127f1ed96` adds one explicit cold-read case to that same production. Its source tree is `5b11506fe665fd7c74478f8ced75326390e6ff40`. The case passed **1/1, zero skips**, at 2026-10-05 03:57:14 UTC. It copied the fully verified ended artifact byte-for-byte, opened a fresh read-only SQLite handle and transaction, and called the real closed-end owner once without mocks or an owner pre-read.

- Authenticated owner read: **82.694 seconds**; guarded run: **86.225 seconds**
- Peak observed worker RSS: **257.2 MiB**, actual heap **1,120 MiB**, Node **26.10.0**
- Input/copy SHA-256: `3627a8d4e7cf99404eef8a6eefd22af591317a6dedcf46d82a0f61972dfa9331`
- End projection: `f35a1d6f5b7b2d70bff1a9e38f27c237b23788a5f6c1210b391cbe82dd1dedc3`
- Whole-history manifest: `ee1eaec4f6670a66a372adb0b734483effb9b1cbc5155d1b253921356611731e`
- Original terminal receipt: `e54a9f26ebc1f71be0110abffc092be0a1ea79f82e1b88907158acde95e63c98`

The full projected bytes, history, future work and original rule/call applicability matched. Input/copy bytes and empty WAL were unchanged; handles closed, all processes were reaped, and source/runtime/control hashes stayed unchanged. The instrumented read window recorded 253 distinct SQL hashes, 11,436 prepares, 16,453 gets and 32,770 alls without retaining statements or results.

The added test also passed a separate complete compiler gate at 04:08:29–04:08:54 UTC on the same 7a6 source, with all 2,078 tracked/generated hashes unchanged. Compiler manifest: `c2515b935e2420f65fd4307c71fb75fa561f9943c7e2f52f28f90ed68af8247f`. No tests were rerun in that compiler-only check.

This establishes one genuine cold historical-read equivalence. It does not establish a new optimized acceptance/rollback gate, the complete actual official/workload/next-pitch pipeline, a current cumulative whole result, or a controlled percentage speedup. The earlier 79-minute source9e27 gate covered several derivations and separate operations; its elapsed time is not an isolated-read baseline. Further CPU profiling remains separate from these accepted results.
