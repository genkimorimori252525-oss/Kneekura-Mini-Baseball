# Flight paired-prefix qualification

An owned flight derive now authenticates its physical pitch prefix once and uses the same detached, frozen rows for replay and hashes. A fresh SQL-only audit checks the endpoint, head, ordered metadata and raw-row identities. Every derive creates a fresh pair; there is no global cache or reusable caller token. Writable Native transactions use a derive-local read guard, while autocommit and prepare-only adapters retain the independent legacy reads. Callback, writer and durable-result ordering remains unchanged.

The meaningful RED on fixed test source `3ded79cb7eb98eea5cf367901057767284885b2e` observed two authentications and execution indexes `[0,1,2,0,1,2]`, with unchanged result bytes and original rows. Its sole failure was the expected-one authentication-count assertion. Both qualified GREEN cuts observe one authentication and `[0,1,2]` with the same byte/row parity.

The qualification runs are separate:

- Author repair `77349c68e26432d2cf321ff39391897fb909e7f4`, source tree `17ef2037a9b8085fe64fa6f5dbea874853147473`: focused compiler and 105 cases across twelve complete test files passed at 2026-10-07 10:33:33 UTC. Final terminal SHA-256: `b72c03c63eaf5b9340df10c0961d1519e886202ae861a90bcdc7a14af5244737`
- Remote-parent integration `72a6741a766e9f827365e3cd0db2ed2066221878`, source tree `52cbad83a88319971f4e8a63d3f72082a2139665`, tested full tree `e052e91bff8b96d4d7cb1b56f17f3a292a0084f5`: fresh focused compiler and the same 105 cases passed at 2026-10-07 11:42:35 UTC. Final terminal SHA-256: `a1920effae27fe99f8d2f63534ad1931f605e69827416d7c38c0de20f3d5114b`

Each run closed thirteen separately admitted stages with zero test failures, skips, todos or unhandled errors. All owned processes were reaped and source, dependencies and controls remained unchanged. The runs are not combined into a larger case count.

The integration is based on Draft PR #349 head `83e32ce8a5e772c250de2d92377a5afcf484169f`. Its two production files, seven test/support files and focused tsconfig match the author bytes; all unrelated parent paths are preserved. This result note is the only addition after integration qualification, so every qualified source/test/configuration byte and the tested source-tree identity remain unchanged.

This checkpoint establishes the focused ownership, alias, cleanup, freshness and regression contracts. Real SWING artifact parity, performance improvement, Native qualification, repeated-batted-root completion and whole-project GREEN remain unclaimed. No UI or Presentation design change is included.

## Subsequent original-artifact attempt

After the focused qualification, the separate author source `77349c68e26432d2cf321ff39391897fb909e7f4` ran a fresh actual-artifact compiler and reauthentication. The compiler passed in 18.167 seconds (final terminal `cfe0afdf0831fe81f86fa6e2ef286cd5d5576a68a295253c0eaf8728f5631e55`). Reauthentication passed in 365.630 seconds, preserving all 76 table fingerprints and eight dependency hashes, with the closed database digest checked (final terminal `7326708fb69035dbf6e9721e052fd6264b9cf14f5763961cfec021d4bb627603`). Both exited zero and reaped all owned processes. These checks belong to the author source, not the distinct publication integration source.

The subsequent flight phase reached the unchanged 1800-second wall cap. Its final terminal `c6e3ffe9ef6fefc8a303e048168294c37404990a8d5b5373d2117c63a187a40b` records 1811.744 seconds including termination and final checks, child exit -9, supervisor exit 2, unchanged source/input and no surviving owned processes. Peak aggregate RSS was 514228 KiB; the stop reason was elapsed time. No flight receipt was produced. A separate read-only inspection of a preserved copy found no committed target-flight row; this cannot distinguish work before INSERT from a rolled-back write. Stage markers place the unfinished operation inside Native flight acceptance.

The failed attempt remains failed and provides no actual-flight, root or performance credit. It does not erase the separately qualified 105-case results or successful artifact reauthentication. Further source diagnosis is required before another flight run; no retry or larger runtime budget is recorded here. This status update contains only concise results and hashes, with no database, raw log, receipt or manifest payload.

## Bounded diagnostic result — 2026-10-07 13:57 UTC

The bounded flight diagnostic located repeated historical-readiness authentication inside actor reconstruction. Marker source `e9dae9f77ce0e1edca667b6d867b25f5b04a9c59` is based on `77349c68e26432d2cf321ff39391897fb909e7f4`; removing all 94 marker insertions restores the four affected domain files, including imports, byte for byte.

Final terminal SHA256: `8455c3799c89dc985e0b905682c732505455f405ddc803f5589d59df579af850`. The unchanged limits were 900 seconds overall, 600 seconds inside acceptance, and 300 seconds for an open top-level group. The diagnostic stopped at the 300-second group limit, reaped its child, and verified unchanged source and input. All Native, phase and root qualification flags remain false.

The first paired derive completed in 166.1247 seconds. Its nested prior-closure historical-readiness read took 82.2096 seconds, followed by a separate activation historical-readiness read taking 83.8830 seconds. These child times are included in the derive time and must not be added to it. Pair loading, encoding, auditing, hashing and physics contributed little to this completed span.

The subsequent open-frame check independently completed another prior-closure historical-readiness read in 92.2323 seconds, then entered another activation historical-readiness read that remained unfinished. Its final 50.6954-second observed lower bound includes shutdown and verification observation; it is neither CPU time nor a completed invocation duration. The result supports a separately reviewed, operation-local repair design. Successful genuine flight acceptance, end-to-end performance and root closure remain unproven.
