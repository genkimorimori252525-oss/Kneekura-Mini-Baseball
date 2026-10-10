# Public field-execution read phases

The public execution owner repeatedly authenticated the same field and completed
execution predecessors during an uninterrupted read group. Its preflight
`derive`/`currentBefore` pair and post-write `currentAdmission`/`read` pair had no
surrounding physical proof traversal, although their lower owners already
supported bounded reuse inside one immutable frame.

The public owner now uses the existing `withBattedVenueLegalReadSnapshot`, which
installs `withBattedWorldPhysicalReadTraversal`, for ordinary local reads, the
preflight pair, the pre-write check and the post-write pair. Authority and peer
callbacks, transaction entry, row/head writes and admission recording remain
outside the read frames. Special received-handoff and renewal owner dispatch is
unchanged. Each independent read and each side of a retry starts fresh.

No cache implementation, physical formula, Source format or archive encoding is
changed. All current-root, known-work, predecessor-rank, head, identity, raw
archive and live-fence checks remain in their original order.

The new `BattedFieldExecutionOwnerReadPhase.test.ts` uses the existing explicitly
synthetic acquisition fixture through its real Native owners. Its intended RED
showed an extra predecessor-plan derivation in the second preflight service.
GREEN retains five separate execution services, sharing completed predecessors
only inside three distinct immutable frames. A real INSERT trigger corrupting
the predecessor is rejected with exact row/head rollback, and peer callback
corruption is rejected on the fresh retry read. Successful retry and independent
read return the exact accepted value without changing the archived rows.

The existing replay-factory test now expects its second service to reuse both
completed predecessors. Both are still encoded by the existing traversal codec;
the service itself remains fresh and still derives the proposed execution.

Author checks, Node 26.10.0, one worker, no result cache, external cache directory:

- New real-owner regression: 1 passed, 13.50 seconds including transforms.
- Existing selected replay-factory case: 1 passed, 3 explicitly skipped,
  15.21 seconds. The earlier stale encoding-count assertion failed and was
  corrected; that failed run receives no success credit.
- Protected 18 source blobs and whitespace checks are unchanged/clean.

No National timing comparison or full compiler was run for this donor. Counts
prove the observed reuse boundary, not a wall-time improvement. The combined
batch owns compiler, preservation selection and independent review.
