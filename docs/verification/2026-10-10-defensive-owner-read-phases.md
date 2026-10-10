# Defensive plan and decision read phases

The Plan owner reconstructed the same observation/context five times during a
new admission: preflight `derive` and `before`, writer `before`, then postwrite
`read` and current `derive`. The Decision owner has the same unscoped admission
groups, and its dependencies read both the current observation context and the
plan's original observation context. Each context reads the observation owner,
then reads the same original field independently. Without an enclosing physical
traversal these adjacent reads cannot share their authenticated field root.

Both public owners now use the existing `physicalStoreTransactionBoundary.read`
for standalone reads, the two sides of a retry, and preflight `derive` / `before`.
They use separate existing `withBattedWorldPhysicalReadTraversal` scopes for
writer prevalidation and postwrite verification. The original `BEGIN IMMEDIATE`,
fence creation, row/head/admission writes and `COMMIT` remain outside those proof
scopes. Authority callbacks run after the prior read has fully closed.

All context, observation, model, metadata, head and freshness checks still run.
Neither context results nor observations are cached. No proof crosses callbacks,
writes, independent retries or the established child-frame boundary. Source and
archive formats, controller semantics and acceptance checks are unchanged. The
existing read transaction owner supplies acquisition/cleanup mechanics; this
change adds no snapshot or cache framework.

## Focused evidence

Two real-owner cases reuse the existing synthetic defensive fixture. Passive
response/field witnesses delegate the exact production calls. Each new admission
requires three distinct phase identities with one original field-root read per
phase and reuse by adjacent dependency reads. Exact retry plus independent read
must use three fresh identities and authenticate the original root again.

Both cases also witness an actual post-INSERT trigger corrupting the original
response, require rejection, and verify exact rowid/value rollback. Corrupting
that response from the retry authority callback must also reject. Both cases
failed the intended missing-frame assertion before the production change and
passed afterward (2 cases, 19.72 seconds including loading).

Three existing WAL cases passed (27.59 seconds including loading): an injected
dependency change inside `BEGIN`, competing acceptance immediately before
`BEGIN`, and a newer observation committed by a WAL peer. The other four cases
in that file were explicitly unselected, with no validation credit.

Author checks used Node 26.10.0, one worker, `--no-cache`, an external cache
directory and an 85-second command bound. The small fixture covers the original
field route; it does not time the National episode-binding ancestry. No complete
National operation comparison or wall-time improvement is claimed. Full compiler
and consolidated finite checks remain central batch validation.
