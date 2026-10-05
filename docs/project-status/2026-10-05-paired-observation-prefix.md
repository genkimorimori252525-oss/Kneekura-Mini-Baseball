# Paired observation physical prefix and whole history

This isolated change removes the second complete physical-prefix projection in `sampleActualFieldObservation`. The physical projection and canonical whole history now come from one operation-local pair. The existing whole-history entry point keeps its original one-argument API.

## Boundary and scope

- Base: `75ff32aed2442de86cfb85ffa0d7a65814c1e742`
- Code and tests: `210f1fc82fcbfe66ebf59ee09f743bb3c2bfdf01`
- Source tree: `33a00345234254cda7af9cc8a67af4a07b8395e0`
- The new public paired API accepts only the original complete prefix. Its private builder receives the projection immediately returned by the ordinary physical-prefix function
- The history-building body, including every validation and serialization check, is byte-identical to the base body after the initial projection statement. Body SHA-256: `101c065762793215f9cf972ceaef2e2527bd0b87d83e66ebf8980d7dda638f53`
- Each independent operation creates fresh physical and history results and reruns both Core validation paths. No caller-provided projection or encoder, cross-operation cache, End/decision cache, calibration change, or other caller conversion was added

## Verification on the candidate

The RED run used unchanged base production. It observed two real projections per observation where one was required, and the paired API was absent. All five existing observation tests passed; the seven new regressions failed as expected.

The same bounded GREEN ran exactly two files and twelve tests: all twelve passed, with no failures or skips. It covers real observation projection count, repeat-call revalidation, legacy and owned history equality, retained Core progress validators, partial/reordered/rebound/unknown/malformed prefixes, canonical-only timeline corruption after a successful call, and the public/private API boundary.

Pre-change hashes captured during RED are pinned in the tests: one Native observation receipt plus legacy and owned physical projections, canonical histories, and whole-history archive encodings. All seven hashes match after the change.

Full `tsc --noEmit` passed against the same source manifest as GREEN. Independent static review found no blocking issues. The two production file hashes are:

- `ActualFieldObservation.ts`: `aba909deb1bede35d2f9ada7b89d5146733905cb9c3414c02ac28c2d79d946fb`
- `WholePlayPhysicalHistoryFromPrefix.ts`: `d759f7a39204476630d6bd89f6d3a3964030e542e7601105dc8b30f9360e083d`

## Exact local receipts

| Gate | Result | Guarded seconds | Peak aggregate RSS KiB | Actual heap MiB | Terminal receipt SHA-256 |
| --- | --- | ---: | ---: | ---: | --- |
| RED | 5 passed, 7 expected failures | 17.201 | 436656 | 1120 | `9fc5b87604c43b748fcd2d2a84e319bcac487cd71f4c9d5d7a788f5daf51f1bc` |
| GREEN | 12 passed | 16.131 | 442980 | 1120 | `289d8a0dd2a26d9b8941fee982755366d9cdf4887313d6cb5f7e071141aaa395` |
| Full compiler | exit 0 | 31.122 | 1325864 | 1504 | `4925d69af085641a9b91142fe7a3bf3a2418fff88fee121602068f979f6bc692` |

GREEN and compiler source manifest SHA-256: `9e0a880883d1f3afd56028dbf14b3b73f2e919af1c33563a481911514a5d0dc9`.

Every gate verified Node 26.10.0, immutable source/control files during execution, and complete process cleanup. The compiler maintained at least 7 GiB available memory. All three resource leases were released at each terminal.

## Separate genuine closed-artifact pilot

One authenticated read passed on the frozen candidate `413d9c45af61646b18453279772379504cd28f54`, with the same source tree `33a00345234254cda7af9cc8a67af4a07b8395e0`. The existing `7a6db1cb1c423da7f8cac254e7919b6127f1ed96` harness was already present and remained byte-identical (SHA-256 `48f9e96ac819792e4847a35fecadc4a9e1b7bbcce4643c461a969a73520e83c3`). It read an exact readonly copy of the preserved genuine chain.

- Input and copy SHA-256: `3627a8d4e7cf99404eef8a6eefd22af591317a6dedcf46d82a0f61972dfa9331`
- End archive projection SHA-256: `f35a1d6f5b7b2d70bff1a9e38f27c237b23788a5f6c1210b391cbe82dd1dedc3`
- Whole-history SHA-256: `ee1eaec4f6670a66a372adb0b734483effb9b1cbc5155d1b253921356611731e`
- Exact projection bytes, whole history, future work, and first-base applicability assertions all passed; one test passed, zero failed or skipped
- Original and copied database bytes stayed unchanged, both WAL files stayed at zero bytes, and the readonly transaction and database handle closed
- All 253 SQL counter records exactly match the previous unprofiled pilot
- Authenticated owner read: **72.693 seconds**, compared with **82.694 seconds** in the earlier unprofiled pilot on source `7a6db1cb1c423da7f8cac254e7919b6127f1ed96` and identical input. This is one observation per source; it is not a repeated benchmark or a general speedup estimate
- Guarded duration: 76.296 seconds; peak aggregate RSS: 498816 KiB; peak worker RSS: 269348 KiB; actual worker heap: 1120 MiB on Node 26.10.0
- The 300-second/1536-MiB aggregate guard and continuous 7-GiB memory reserve held. Source, controls, and runtime stayed unchanged; no owned processes remained and all leases were released

Pilot source manifest SHA-256: `1116530612417385da58036cb362448b59192859571d044728c34173ce72c14a`.

Pilot terminal receipt SHA-256 `477f4710fe3bea8423a66fce4685a238fe3fc3d0c49ef036ec760e01587bcf37`. The independent timing and SQL comparison is recorded in `closed-read-comparison.json`.

These results establish the scoped reduction from two physical projections to one per observation and exact physical-proof equivalence on the preserved chain. They do not establish a whole-pipeline pass, full-suite pass, or official acceptance. The pilot does not interpret the fixture's original rule profile or change it. Raw CPU profiles are not included.
