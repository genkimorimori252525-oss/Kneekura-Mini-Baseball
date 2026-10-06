# Positive checkpoint tail: bounded artifact evidence

At 2026-10-06 01:59:41 UTC, the separate authenticated ended-checkpoint tail completed with `passed: true`, `reaped: true`, no remaining owned process, unchanged source/dependency/control/input pins, and no cleanup error. The compiler passed; the one Native artifact case passed in 713.9037 seconds including audit, with peak aggregate RSS 809,688 KiB. This certifies that tail on its pinned source only.

The input was the preserved ended database from the interrupted original Positive attempt. Authentication occurred before opening writer stores. The tail retained the original same-cut receipts, reached a real writer `BEGIN IMMEDIATE` and the sealed-end terminal census, then observed `ROLLBACK`, `total_changes()` 0→0, and no remaining writer transaction. Close/reopen, identical end retry, and original call/observation receipts stayed unchanged; the copied database and original input retained the pinned input hash.

There are 18 observed before/after operation pairs. Four end derivations are **source-expected**, from one initial closed read, one reopened read and two reads in the unchanged identical-accept path. The raw `endDerivations` field is attributed by the test; it is not an independently instrumented internal call count. Main table/schema equality and TEMP schema-version equality were checked on the observer connection; this does not certify writer-private TEMP state. The preclose/reopened umpire reads preserve the original plain store API, without adding helper read transactions to those paths.

## Exact identities and preserved source

The [review patch](2026-10-06-positive-checkpoint-tail-c68-to-7a448.patch) is the exact full-index Git diff from production `c68a3dc47196b1aae2cd678470ebaad207992d1a` to tail `7a4489673f7966cc8528b0687aeeb66942b6111b`. It adds only `ActualFirstBasePlayEndPositiveCheckpointTail.test.ts` and `ActualFirstBasePositiveTailFenceWitness.test-support.ts` under `src/host/world/`, totaling 300 source lines. Production files and the original full Positive test are unchanged between those two sources. The optional tail is preserved as a patch under `docs/verification`; it is not installed in the current source inventory.

- Patch SHA-256: `6058ca0c56e6c9207856a4b9b42cc20d9feb038c28307cc60fca746caa72a9eb`
- Production full Git tree: `cb72231a80c31ee046fe08d4134e1c200889348e`; `src` tree: `183e367eda89426b32707bb1d5d5e108ddc59455`
- Tail full Git tree: `afae42a502af3c8506be09f4da370ccdd310bf62`; `src` tree: `3bb2904a92929d1bb3848074e100ea075e3d8da9`
- Production full-source manifest SHA-256: `70725dda193c8ec1170cf2b6de5718a71b7cbeeb0c8a7c75a400f5b8dc091b5e`
- Tail full-source manifest SHA-256: `f29cc2d08e0f7825e614312f8557d40e59c40cf3c6bff44fef7fa07d22a85d15`
- Tail test source SHA-256: `075755b0f95082ab0da8748fb6a7853ef6858d325ed0b74e7debd4d6708212fc`
- Witness source SHA-256: `3c61569734bcdcfd068b0ce017a629a25758032ecd3cae696f1a0534a9fbf0e9`
- Original full Positive test SHA-256 at both sources: `7124973b082245e654b09babaa70bdabcd58eff2065a7cd0c4cf468404ccc0d1`
- Input database SHA-256 (3,362,816 bytes): `a64e78d7beeeca80c098a2a64ca4be328077dcb41457a89e63879eee4a0426a9`
- Control manifest SHA-256: `32a0269ea1d1442b164fecd42777180356c7debfdb7c8f818f65e25a37464437`
- Tail configuration SHA-256: `e450a04ac4a26d9a48f0b87cb1df8907021b2de6c927840fd6d4b52912058774`
- Supervisor terminal SHA-256: `51437c3aa4b2f5769504244b5fc1dd37cf385d4ba0670b3a79cfa27534cbc309`
- Tail result SHA-256: `2e6d296a3b7931db446d47591f8b3274c2fa773f1cd8d883fe6cbbc420e1bcaf`

The terminal/result identify the tail commit and production commit above; the pinned configuration links their full-source manifests, input and controls. Static audit verified the patch against the exact Git diff, reconstructed both added source files and checked their hashes against Git and the source manifest. Its contents are source code only: no database bytes, raw projection payloads, control/runtime dumps, credentials or private personal data are included.

## Boundaries and separate remaining work

The original [3,660-second Positive ceiling](2026-10-05-current-cumulative-positive-time-budget.md) and [three completed 32-piece cases](2026-10-05-current-cumulative-32-piece-progress.md) remain preserved. The tail inherits checkpoint construction; it proves neither original prefix construction nor the original unsealed corrupt-trigger rollback. `originalPositiveTestPassed`, `wholePipelinePassed`, `originalPrefixConstructionProven` and `originalUnsealedSealRollbackProven` remain false. It is not a full Positive or whole-project PASS.

A separate coordinator-owned `c68a3dc` remainder attempt launched at 2026-10-06 02:00:41 UTC. Its live coverage and results are outside this checkpoint; no current remainder counts are claimed here.

This documentation checkpoint starts from published PR330 base `cb32ad1e3ae14064b2e594a269453468291d077c`, whose Git metadata and source differ from the pinned tail run. The local tail commit is a provenance identity, not an assumption that it is available in published history. The patch preserves exact test source for review and recovery; it is not a runnable reproduction package. This checkpoint performed only static file/Git/hash checks, with no application runtime, compiler/test, database, lock or GitHub-publication operation.
