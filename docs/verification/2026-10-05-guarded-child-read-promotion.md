# Guarded child-read promotion

An authenticated child traversal now promotes completed immutable field and execution nodes to its enclosing operation only after the child guard, private savepoint release and connection cleanup succeed. Every child starts with fresh maps and a private encoder. Execution reuse requires the exact opaque owning field-frame identity. Independent operations and transactions still reauthenticate their input; no global cache is introduced.

The reviewed downward-sharing preview was never applied. Its source review identified a same-connection rollback/begin plus peer-WAL mutation path that could expose stale child evidence before the outer guard rejected. The accepted upward-only change preserves the fresh-child rejection boundary, including failed-child and cleanup-failure isolation.

## Fixed-source evidence

- RED source `8f4f39997ea330100b88efc7253b7cbd7f7c2ebe`: 24 cases, 21 guards passed and three intended reuse assertions failed; no unexpected failure or unhandled error. Receipt SHA-256 `02c50bc6c4c32d4501732a8b1d7a837fadcf2c541d613820014cbfbe6e377283`
- GREEN source `20f75a54a380457027158f07001437543191ac84`: 122 Native cases and compiler passed, with source/dependency/control identity unchanged and no owned process remaining. Receipt SHA-256 `56caf79ab26507f18d01541e9e9c224a02939b459c0818f9d837126afc892a00`
- Same GREEN source, standalone original settled-role artifact compatibility: two fresh read-only/query-only connections reproduced the exact original settlement and current-head observations, with zero writes and unchanged durable DB/WAL/journal bytes. Receipt SHA-256 `56f4502e69fa918be2dd24b51b25197f72cba1c5a9102be3133bbe213ea7c9aa`; supervisor terminal `bb46414d950b1776e22f22359de423ca999ad084e6e9938ef85c970e26e34153`

The two reads took 78.234 and 75.249 seconds; the earlier complete reader source took 85.456 and 90.161 seconds. These timings describe different complete source cuts and do not isolate a speedup caused by these two files. The compatibility helper was used unchanged. It privately owns fresh connections and checks the exact main filename; it does not assert the entire database list or an empty TEMP schema. Shared-memory sidecar state is observed rather than treated as durable artifact identity.

This standalone comparison is not a new pipeline transition admission or a repeat of official/workload/next-pitch mutations. The original sequential chain and its source ancestry remain recorded separately. No database payload is included here. Current cumulative whole-project and forty-piece archive acceptance remain separate gates.
