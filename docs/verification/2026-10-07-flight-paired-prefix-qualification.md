# Flight paired-prefix qualification

An owned flight derive now authenticates its physical pitch prefix once and uses the same detached, frozen rows for replay and hashes. A fresh SQL-only audit checks the endpoint, head, ordered metadata and raw-row identities. Every derive creates a fresh pair; there is no global cache or reusable caller token. Writable Native transactions use a derive-local read guard, while autocommit and prepare-only adapters retain the independent legacy reads. Callback, writer and durable-result ordering remains unchanged.

The meaningful RED on fixed test source `3ded79cb7eb98eea5cf367901057767284885b2e` observed two authentications and execution indexes `[0,1,2,0,1,2]`, with unchanged result bytes and original rows. Its sole failure was the expected-one authentication-count assertion. Both qualified GREEN cuts observe one authentication and `[0,1,2]` with the same byte/row parity.

The qualification runs are separate:

- Author repair `77349c68e26432d2cf321ff39391897fb909e7f4`, source tree `17ef2037a9b8085fe64fa6f5dbea874853147473`: focused compiler and 105 cases across twelve complete test files passed at 2026-10-07 10:33:33 UTC. Final terminal SHA-256: `b72c03c63eaf5b9340df10c0961d1519e886202ae861a90bcdc7a14af5244737`
- Remote-parent integration `72a6741a766e9f827365e3cd0db2ed2066221878`, source tree `52cbad83a88319971f4e8a63d3f72082a2139665`, tested full tree `e052e91bff8b96d4d7cb1b56f17f3a292a0084f5`: fresh focused compiler and the same 105 cases passed at 2026-10-07 11:42:35 UTC. Final terminal SHA-256: `a1920effae27fe99f8d2f63534ad1931f605e69827416d7c38c0de20f3d5114b`

Each run closed thirteen separately admitted stages with zero test failures, skips, todos or unhandled errors. All owned processes were reaped and source, dependencies and controls remained unchanged. The runs are not combined into a larger case count.

The integration is based on Draft PR #349 head `83e32ce8a5e772c250de2d92377a5afcf484169f`. Its two production files, seven test/support files and focused tsconfig match the author bytes; all unrelated parent paths are preserved. This result note is the only addition after integration qualification, so every qualified source/test/configuration byte and the tested source-tree identity remain unchanged.

This checkpoint establishes the focused ownership, alias, cleanup, freshness and regression contracts. Real SWING artifact parity, performance improvement, Native qualification, repeated-batted-root completion and whole-project GREEN remain unclaimed. No UI or Presentation design change is included.
