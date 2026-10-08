# Terminal acknowledgement metadata checkpoint

This is rejection/discovery qualification only. The production runner still has no `acknowledge` method, no acknowledged-stage success reader and no new schema capability. Genuine A01 missing-method RED remains required before implementing those operations.

## Source and scope

- Pending prerequisite: base `28868f1`, source tree `8c0ad51bc2e444b5ac97f6c697c0c76eae73d9fe`. Coordinator verified genuine P11 terminal `89de1c8e17c816716b31315cb7834f3a3345f23deaa45e82dbcd343e664afe38` and three genuine P17 rollback cases, terminal `7df524321fe5fe02389272f95744b246b9ee69a5f6251769a1c2b10e60787b85`.
- Test-first metadata source: `20a2842c5904a2551c5b821df90ab28114cbb0a3`, source tree `5b7c2c905b7a5bb8fa3d0a7ef58bb44ad081fe21`. Production remained unchanged from the pending base.
- Minimal metadata repair: `d857b99c46368ded1a83c09698bca4d35822bf2b`, source tree `b37c33effd1407a2e504385f56dbfe56044cf910`. Changed only `ActualFoulTerminalApplicationOwnership.ts` and `FoulTerminalNextPlayGuard.ts`.
- Test-support type repair: `0e968ea33d97a4c9011e9bb5fe1caa6fb4f18a7d`, source tree `5554e2fd59492b7eb4e509a746906259a40f09d7`. Explicitly retained already-present `unique`, `partial` and `origin` fields in SQLite index metadata for TypeScript inference. No production or metadata-test behavior changed after the 40-case GREEN.

The repair discovers raw acknowledgement IDs as their own identity domain, follows the Source explicitly encoded inside the exact versioned three-string acknowledgement ID for rejection, and discovers original Match/previous-play scope in an acknowledgement application reference. It never authenticates a consumed object or creates a success receipt. Raw duplicate/escaped keys and array ancestors remain visible. The next-play guard uses an existing application's original previous-play scope and preserves unrelated earlier-PA admission behavior.

## Bounded results

All runs used one worker/process as applicable, Node 26.10.0, 512 MiB old-space, measured 608 MiB V8 heap limit, 768 MiB aggregate RSS ceiling and 180-second external wall cap. Each stage pinned the full source tree, dependencies, controls and runtime, retained private locks, and ended with unchanged inputs, no cancellation and no remaining owned processes. Expected assertion failures receive no GREEN credit.

| Stage | Evidence | Result |
| --- | --- | --- |
| Metadata RED | terminal `9615b18b4e197fd30e590a454ce4c9e464bfabf6691dd03682f1e70ee764314c`; report `05bd0f133085b1ddd7bb61ee31f802f08c208b9527357e2aa1e357c5da524cc9` | Exactly 11 intended missing-discovery/guard assertions failed; 11 existing/negative controls passed. No setup/controller error. |
| Metadata GREEN + unchanged pending regressions | terminal `6728761458c6c628d3e40c473b315a2df761c0e8ce758b79166532a1abc4344c`; report `552fcd454ff13b1bb80470e7383c547542fba01220cbf58a89feeb6ecff5cd7c` | All 40 selected cases passed: 22 acknowledgement metadata and 18 unchanged pending metadata/guard controls. |
| Initial focused compiler | terminal `9ac604498b8f5cf6f7cb8d718f0758839f84db1272de90b7d13ae8e1b66b6e8e` | Failed on three test-support property-inference errors. No pass credit. |
| Corrected focused compiler | terminal `4152436fec4288078a1e17ccdd5499950058d8b968be5a52b552ca970dcf5a48` | Exit 0 against `tsconfig.terminal-acknowledgement.json`; includes new acceptance/support code and actual runner. Compiler child-process launches were disabled. |

The RED markers were `ACK_ID_SCOPE_MISSING`, `ACK_ID_TRANSITIVE_CLAIM_MISSING`, `ACK_REFERENCE_SCOPE_MISSING`, `ACK_REFERENCE_SCOPE_GUARD_MISSING`, `ACK_EMBEDDED_SOURCE_CLAIM_MISSING` and `ACK_ESCAPED_EMBEDDED_SOURCE_CLAIM_MISSING`.

## Limits and next gate

The independent static contract review corrected genuine RED sequencing, second-copy applied-stage provenance, legacy-schema stage rejection, target rowid pinning, raw identity collision fixtures and test cleanup. A01 now performs genuine queue/E/C reads and witnessed pending apply/mirror checks on the legacy CHECK layout before asserting the missing acknowledgement API. Only subsequent GREEN work can create the acknowledged CHECK layout on a second exclusively created private copy with its own applied-stage control record. The current frozen cutover test predicate demonstrates exact legacy SQL refusal; it is not execution of a frozen full old runner.

No acknowledgement Native acceptance, real acknowledgement rollback/corruption, strict receipt/stage/schema, acknowledgement raw-only public-wrapper, or second genuine-origin swap case has passed at this checkpoint. Full suite, whole-project GREEN, original pending retest, scoring, workload, reset and new-pitch authority remain unclaimed. Existing ordinary/v2 compatibility qualification is not broadened by these metadata tests. The private retained producer is preserved and was not regenerated or opened by these LIGHT runs.
