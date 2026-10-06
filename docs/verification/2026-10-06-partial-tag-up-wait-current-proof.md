# Partial tag-up wait Core: recovered source and fresh qualification

Recorded 2026-10-06 06:34 UTC. **Fresh exact-source Core47 and full compiler passed.** This checkpoint contains code/result metadata, synthetic test names and generic control paths. It contains no database, domain payload, credentials or environment dump.

## Exact source recovery

- Tested recovered commit: `b6f5e726a40e5fc5c1682749fd846f644580fef9`
- Source tree: `0aa6b0f02921463b614fc0a59cb9129967498034`
- Tested full tree: `2668859676ef2731fe9287df3c5aca5d5f33328e`
- Restored PR333 base: `936a07033b47208b87aaf2fdefcb9eef057e3c49`, byte-equivalent to old documentation base `1971e245`
- Eight-path author patch SHA-256: `0b99ddf17aedd07a4a3111517de47733edb023b28553127ecbb1b63162c10c14` (`--abbrev=8` serialization)

The source, tests, semantic spec and original status were recovered from complete retained text. Both historical source/full trees and the exact patch match; no source body was guessed. Commit metadata changed. All unrelated base files and publication documentation were preserved. This later docs/result commit is separate from the tested full tree and preserves the tested source tree.

## Fresh receipts and exact selection

The complete terminal receipts are preserved byte-for-byte here:

- [Compiler receipt](2026-10-06-partial-tag-up-wait-fresh/compiler-terminal.json): `f7c8864a8f392c6b399cdc983a96dec180158c5403332a9778c2ceb9575e3f8e`
- [Core receipt](2026-10-06-partial-tag-up-wait-fresh/core-terminal.json): `e4a077e292ef709f0b70561887ad366a9436b7490e3693309107e3f8976e3342`
- [Exact file/case/ancestry inventory](2026-10-06-partial-tag-up-wait-fresh/selected-cases.json) records all 47 selected cases

The selection is boundary1, partial wait28, legacy RunnerDecision9, RunnerDecisionTiming3 and ActorPolicySettlement6. Core passed 47/47 with zero failed/pending/todo cases, no unexpected/suite/unhandled errors and exact names/ancestry/counts. Full project compilation passed separately. Compiler ended at `2026-10-06T06:31:13.642256+00:00` in 28.102 seconds; Core ended at `2026-10-06T06:31:33.783375+00:00` in 4.175 seconds. Both exited zero and reaped all owned processes, with no remaining process, guard or cancellation and unchanged source/dependency/control pins.

- Reviewed fresh v2 controller SHA-256: `41f3d1ceb36792f01affe68923a3adf977184ba74b43bd4f3492c798f03c3064`
- Configuration SHA-256: `92e50715d31c0389ce5d33c90c5cd7a95eb9bfe69df7ef0719d6aa699964d078`
- Exact 983-file dependency manifest SHA-256: `e9624551894fd127f81b5e475c928741bce41fac2012d369b6cd62b9b08fc542`
- Reviewed generation/pidfd helper SHA-256: `17c73eb414b32f9f1616b5e4e58ac1077a0449dd5b6887c0291369b73ce9ca9f`

Fresh supervision uses three nonblocking locks, actual heap and distinct worker receipts, bounded RSS/wall time, separately pinned immutable roots, append-only PID/start generations, authenticated pidfd signaling, subreaper cleanup, repeated exact HEAD/src/full-tree/dependency-alias audits and one consistent final cancellation snapshot. The recovered catalog came from a new actual compiler bootstrap: all 15 inputs matched before copy, terminal SHA-256 `056e38d5529c7b2f7e6e2b5613d9bf5c82c76c87f5675aff4fe59792196bb47d`. These two fresh application phases inherit no lost historical receipt.

## Environment loss and historical attribution

The 05:38 UTC workspace replacement lost unpublished checkouts and original raw qualification files. Published PR333 remained durable. The later three-doc snapshot was also recovered exactly (full tree `1450a82e49ee3a1947ecc781530f1e07e8d0e59f`, docs patch `bdd364d0633c94a41666e4052981e68354395d0963d28a9fe17416c191c7ec48`), but that recovery does not restore its raw receipts.

The following results remain historical observed attribution only; their absent raw files were not recreated or used as fresh gate prerequisites:

- Initial `fb11bb7` boundary1 RED: `a0b4b606a625e685b7cbbb9890768a282f01db803648889837bd7b4fc1a87474`
- Initial `fb11bb7` Core28 RED: `7df9eea0a970b88269d0db724043a75c7a27b9bc7d108fe72623105920488e38`
- Author `e8db3e3` compiler / Core47: `1934edaf02e5e543e018a75f33be83bb63d7b0d4ac759bcf8d34c839c82b75a7` / `8074bc19c4be32e857d86bd9d65ddd585e44d5d3b2dc5e18cbbec0b64974bfd5`
- Previous current `3c411b24` compiler / Core47: `cedc00fbee3d02c148432e4e85e2ecdb9b050cd3d44b6e25e166e9240df3625c` / `7f4d7e217d5bf2ec1f7dbe2b1236ab0c042a30645d4deb9e7f5e6b071285e534`

Initial RED established only the missing entry, not individual guard failures. Fresh GREEN reaches the unchanged behavioral/adversarial cases. The full fresh receipts above and their exact inventory are included in this docs/result commit so publication can retain the current raw qualification.

## Bounded behavior and remaining work

The versioned partial entry consumes explicit wait-only context and selects the existing complete Core `hold/tag_up_wait` result with actual observation/consumption timing and existing cognitive delay. It preserves legacy boolean behavior and leaves force/cue production explicitly unavailable. `tag_up_wait` remains active; a hold decision is not terminal settlement.

Native semantic sensor production, prospective view/model admission, strictly positive spatial/temporal capture, actual availability/replay, durable selection and runner issuance/adoption/motor/settlement remain unproved. The entry does not derive these facts from physical contact. See the [semantic contract](../superpowers/specs/2026-10-06-runner-visible-contact-partial-wait-contract.md) and [Core status](../project-status/2026-10-06-partial-tag-up-wait-core.md).

The separate [485-case union](2026-10-06-current-native-union-acceptance.md) remains historical `cc268e71` attribution and was not rerun. No totals combine these sources. This is not whole-suite, whole-pipeline, genuine SAFE or general-runner completion; the approved non-design plan remains incomplete. No runtime or remote write was performed by this documentation preparation.
