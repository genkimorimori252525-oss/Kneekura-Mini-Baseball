# Terminal deterministic scoring: bounded progress

The acknowledged retained-copy prerequisite is qualified only for the coordinator-approved applied/acknowledged pair at `cf5f83fb2c454cba431dbbffb22e44a238ef6001`, terminal `6bd8a981679e14bc3bc4eb9a38881d12f30ee968d30426abbbd259319f3a495a`. Its broader acknowledgement fault qualification proceeds separately. No second genuine terminal origin is claimed.

## Observed RED before production behavior

At `238a8e97257b1f4b87c5ff15247a94dff3425103`, S01 authenticated the existing original P/C/E/journal, acknowledged terminal and pending mirrors, assigned call identity, preserved oracle distinction and explicit scoring layout. It then failed exactly at `GENUINE_ACKNOWLEDGED_TERMINAL_SCORING_API_MISSING`. Terminal `ed4d41797af25f75992c8eb670f59d61edd1ed620e4f569db8afa60a2e72b29d`, report `1e74d1a83b25055fce537ea79e7a38d88561e360682d9be3f38334c73fd97d17`: one expected failure, no skips or setup errors, all four input groups unchanged and complete process reaping.

Two earlier setup attempts receive no RED credit: a test-only TypeScript cast syntax error, and a deep-value comparison distinguishing stored `0` from rederived `-0`. The latter was corrected only to use the already established durable canonical JSON comparison. No physical or serialization semantics were changed.

## Reviewed implementation and bounded positives

Independent source review required three fixes: explicit retirement after proof RELEASE/restoration failures, complete official-table layout admission, and bidirectional Source/closure alias discovery. All were repaired before GREEN. The public legacy scoring types/bytes remain unchanged; terminal mode is rejected by all three old scoring APIs and by legacy workload/history/actor consumers.

- Focused compiler passed at `40757b8`; the later bare INSERT spelling preservation is covered by canonical scorer tests and changes no types.
- At `0442f09`, source tree `63757183f47a1102be506841a66c7de6bcf5c482`, 61 selected LIGHT cases passed: 15 raw metadata, 16 storage/proof-retirement, 22 legacy consumer/type, and 8 unchanged canonical scoring cases. Terminal `d58a7cdd2d179a218c44b7b28866488a2b59a217526485537be2c1d47c3840ef`, report `28a022cb2bf85daa34af708db708bad6462b04caa285185ff9b880c391a9901b`. No skipped/unhandled/setup failures; four input groups unchanged; complete reaping.
- Genuine S01 passed at the same production cut. Terminal `6b840b353437c3358b95c5212c2c6088c012d57d2b23571dcb7e9e0bb8ccfc32`, report `8bf2f09e83bdb633ea314779fefe3d033ee8124c0420c505651b42ffea9a2e1c`. It witnessed one canonical scoring INSERT with the original assigned call, immutable raw P/C/E/journal/proposal/acknowledgement/application/Match/workload/schema, zero-write read/apply/reopen retries, old scoring rejection and both next-admission fences. One case passed, no skips/errors, complete reaping, peak RSS 584,516 KiB, four input groups unchanged.

## Still pending

S02–S04 Native INSERT-fault/freshness/transaction cases and sixteen added S05 dependency/archive integrity cases remain unrun at this checkpoint. The added tests change no production code. Existing actual-live scoring parity also remains pending. Synthetic metadata/storage tests prove their own layers only. Workload, completion, reset, terminal history replay and next activation remain outside this scoring slice.

## Later qualification

This is a historical checkpoint. The remaining bounded cases, subsequent transaction-boundary fixes, independent review and source-attributed final evidence are recorded in [the later qualification note](2026-10-08-terminal-scoring-qualified.md).
