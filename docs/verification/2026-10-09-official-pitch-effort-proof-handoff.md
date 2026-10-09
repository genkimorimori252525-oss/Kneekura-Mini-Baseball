# Official pitch effort: adjacent projection handoff

A fresh official pitch effort acceptance projected the same accepted evidence three times: before insertion, while decoding the inserted Source, and immediately afterward to compare official evidence. The decoder already returned a completed projection of that evidence. The third traversal repeated the same derivation without an intervening write.

The inserted Source is now decoded once inside an owned, read-only transaction phase. Its complete projection supplies the immediately adjacent official-evidence comparison. The phase checks a private savepoint identity, query-only setting, total changes and main/temp schema counters. Acceptance uses the existing physical-store transaction lifecycle, including retirement when a replaced or actually committed transaction prevents proven rollback. A real commit is never compensated with a repair.

This retains one prewrite and one postinsert projection, unchanged persisted v1 Source/proof bytes and policy validation. Public reads and later accept retries independently decode and rederive. No proof survives the phase, next write, operation or commit. The ordinary close error remains compatible.

## Finite evidence

All fixtures here are fresh structural Core/Native fixtures. They do not qualify any retained physical terminal or grant genuine boundary credit.

- Four focused RED cases demonstrated the third projection and acceptance of an actual byte-neutral Source write, a replaced transaction with restored rows, and an actual forced commit. Terminal SHA-256: `deee4e82cfebb9d41d13eaee57aa62dbccb264f9f400b9e49791d64b5c22a05d`.
- First four-case GREEN: `fd0c9c749e3f96d2d5ace99f5329c85fec2b7005ade19525fd685ce4b4742d9f`. After preserving the ordinary close error, the final compatibility lane rechecked these same cases alongside workload, initial-world, duplicate-charge and physical-closure compatibility: 61 passed, no skips; terminal `6ebf99c410703f577bf5e191c0d6e5ecb27b40876f0a67dca94ac7a183b67be8`.
- Full root TypeScript compilation passed with terminal `766d7588b8df7efad4d9d9d1ff103e1d7772ee8a520dff485b43a9d2e8e99a15`. The final compatibility and compiler used identical frozen source digest `fa2542432187baa159f08f2ae6ec8cd484345efd1bd0ef6afa527e82a72d7719`.
- The first compatibility attempt ran 61 successful tests but was correctly FAILED by exact-inventory validation: five parameterized expected names omitted Vitest's quoted string formatting. Failed terminal `1f0546fe6b0c623a0b61dfcb20b2dc1ce1e2ba9995f741fa37dc1fcd6a6af897` remains failed. Only those five expected names changed before the final lane; source and tests were unchanged.

Small fixtures used 512 MiB old space, measured 608 MiB heap, 1,024 MiB RSS and 120 seconds. The full compiler used 1,664/1,760/2,304 MiB and 180 seconds. Both required RSS plus 4 GiB available at launch and continuously enforced the 4 GiB reserve. Successful terminals have exit zero, complete owned-process cleanup and unchanged source/dependency/control/runtime groups.

The genuine completed-endpoint recovery and next-actor candidates retain their separately reviewed production source. This candidate still requires independent review before any genuine input uses it. Private databases, return payloads and controls are excluded from this source checkpoint.
