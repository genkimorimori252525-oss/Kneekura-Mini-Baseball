# Received-umpire defender policy data: inert immutable owner

2026-10-08. This slice adds an explicitly imported data boundary only. It does not enroll a policy in a live play or change the existing received-call v1 adapter.

## Accepted contract

`openSqliteReceivedUmpireDefenderPolicyDataStore` exposes only `accept(sourceId)`, `read(sourceId)`, and `close()`. Its authority supplies `readAcceptedPolicyData(sourceId)`; no dependency snapshot is accepted from that callback.

The Source contains exactly:

- `sourceId`, `sourceVersion`, `careerId`, `playerId`, `personLinkSourceId`, `fieldingModelSourceId`
- `capability: 'received_umpire_defender_policy_data_v1'`
- `provenance: 'explicit_imported_policy_data_v1'`
- `acceptedAtDay`: a nonnegative safe integer
- `profiles`: exactly `out` and `safe`, each explicitly null or exactly `{ballPursuitPriority, holdPriority}` with finite priorities in `[0,1]`

Every ID is nonempty and already trimmed. Missing fields, extra fields, getters, symbols, inherited/nonenumerable properties, nonfinite values and incomplete profiles reject. The Source is detached and recursively frozen. The provenance literal means an explicit import; it does not claim calibration or production certification.

The durable value is exactly `{source, fieldingModel}`. The original fielding owner reconstructs the model; the original Person-link owner independently authenticates the intake. Career, Player and Person-link identities must agree, including `fieldingModel.person.sourceId`. Person ID is derived. Policy day must be at least the model's accepted day.

There is deliberately no comparison to a current game day or pitch. Future-day inert data is legal here. A future live availability owner must independently require `acceptedAtDay <= gameDay`, exact original binding and an authenticated intraplay availability moment. This owner supplies none of those facts.

## Storage and integrity

The sole added namespace is `world_received_umpire_defender_policy_data`, with a Source primary key and one immutable baseline per `(careerId, playerId)`. A second baseline rejects. Identical retry or authority-free retry returns the same historical bytes. A changed callback Source rejects. There is no replacement, revision history or latest-policy selector.

Source and snapshot JSON/hashes are checked against fresh original-owner replay. A selected-dependency census additionally rejects conflicting raw Person Source/Player/Person claims and raw roster Career claims ignored by the legacy indexed readers. It leaves unrelated valid owners outside the selected scope and changes no legacy reader. SQL discovery includes indexed identities, raw Source/snapshot identities and all original Player scope mirrors, including nested fielding and Person ownership. Decoded escaped keys, duplicate identity leaves and later duplicate containers cannot hide a conflicting original row; canonical byte equality rejects ambiguous archives.

Admission validates the emitted owner schema and original dependency ownership constraints. It rejects owner views, weakened constraints, extra columns, triggers and authority shadowing. Authentication runs on the same connection before writing, inside `BEGIN IMMEDIATE`, and after insertion. Read proofs are query-only savepoint scopes. Exact change and schema counters permit only one new policy row.

The successful-commit path checks the exact durable own row without calling an acceptance callback after commit. A replaced COMMIT that actually rolls back is rejected and retires the handle. Failed transactions roll back; cleanup failures retire the handle. Exceptions after a real BEGIN are included in cleanup.

No old model/plan table is written. Runtime registration/admissions, physical/decision/motor owners, Core conversion, work consumption and the v1 null-policy/null-previous wire remain unchanged.

## Verification scope

The new Native unit suite contains 26 named cases across Source, ownership, schema and transaction tests. Fault cases include:

- Unsupported original Person intake, moved/escaped/duplicate identities and scope containers, duplicate profiles and corrupted archive hashes
- Callback Source drift and original dependencies changed before/inside a transaction
- WAL contention, exact historical retries and original-byte preservation
- Actual INSERT witnesses for non-owner write/schema changes and COMMIT replaced by ROLLBACK
- Read-proof side effects, transaction replacement, exceptions after BEGIN, rollback failure and reentrant callbacks

The initial missing-API RED is setup evidence only. Separate behavioral REDs were observed for original Person-owner replay, owner schema admission, callback drift, write conservation, rolled-back commit durability, acquired-BEGIN cleanup weakened original schema, and hidden selected Person/roster dependency claims. Each was followed by a passing bounded GREEN run.

The existing 83-test Native v1 guard/Core received-call suite also passes. Full-root TypeScript compilation passes. An initial compiler run found two test-only overloaded-method wrapper annotations; those were corrected and the compiler rerun. No full repository test-suite result is claimed.

Tests used Node 26.10.0, one worker, pinned source/dependency/runtime/control inputs and bounded private output directories. Tests used a 1024 MiB old-space limit (1120 MiB measured heap) and 2048 MiB RSS cap; compiler used 1408/1504/2048 MiB. Both enforce a 4 GiB live host reserve and a 6400 MiB launch floor. The optional existing Tinypool two-command CPU fallback retains exact dependency pins and actual `os.cpus` evidence. Inputs were unchanged and owned processes fully reaped at qualified terminals.

The ignored generated catalog was reused only after matching its generator and 14 data inputs; its SHA-256 is `4a7452ba4b6d600cfca498f79759f678f4c85884add1d7eee866638e222c0263`.

## Synthetic data and explicit limits

Test priorities were copied explicitly from `src/core/sim/fielding/ReceivedUmpireDefenderReplan.contract.test-support.ts`, SHA-256 `7e1ad727c1dbfaadfb143a37989aa8a161d767cba52672ce434e0af0692a4eb4`: OUT `(0.1,0.9)` and SAFE `(0.9,0.1)`. They live only in test support. Production imports no fixture and supplies no default policy values.

## Qualified private-copy proof

After independent code review and explicit runtime release, `ReceivedUmpireDefenderPolicyDataArtifact.test.ts` passed its one bounded Native case on an exclusively created private copy of the existing after-observation database. No root, call, reception or received pipeline was reconstructed or rerun.

The test authenticates all 36 existing lineage file hashes and the original fielding/Person binding, then adds exactly one inert policy table, its two automatic PK/UNIQUE indexes and one row. All 69 original tables, 135 data rows with rowids, 196 schema rows with rowids, 24 admissions and all original physical/observation/decision/motor heads remain exact. Every new stored column, canonical Source/snapshot JSON and hash is independently checked against the supplied Source plus the separately read original Native fielding model.

A real native INSERT witness and per-connection counters establish write deltas `[1,0,0]`: one initial insertion, a zero-write identical retry, and a zero-write authority-free read/retry after actual close and reopen. Output WAL/journal files are absent or empty at every closed-handle checkpoint before hashing the standalone main database. Original main/sidecar and all lineage bytes are unchanged. A separate Python immutable read-only audit independently verified the row/schema delta, rowids and exact new policy row after the Native run.

Evidence identifiers (the private database and raw manifests are excluded from publication):

- Qualified Native terminal SHA-256: `75c00f46d4037df4f716d8f7f820fc84cf494b6014e7d80267de491205db90d5`
- Proof receipt SHA-256: `25ce28e8eeff879168a32068a27e741b43fd3bc903872f8cac9a16a472a4090c`
- Independent postrun inspection SHA-256: `5fbd60defd056403abb5eb300184801c793066438eb847277ebd09b703854f9c`
- Original database SHA-256: `b281f59e66237b93b33d985db53f260566fcbf5facc07eb477e5eb5baf4c4c7f`
- Result database SHA-256: `3e21f81b1cbaef5cc1148b1e7c39d38ab70d5e24bc89535ed739486067779158`

The supervisor authenticated the actual bytes of all 1,953 source files from reviewed implementation `4ee6093bbf6ddb270f5312c5d32178c6fff4b7b9`, plus the complete test-candidate snapshot. The proof used the same capped runtime/dependency controls, a 180-second wall ceiling, and finished with exit 0, no skips/errors, unchanged inputs and full process reap.

This qualification grants no live policy availability, prospective enrollment, received-process persistence, work consumption, motor renewal or production-calibration credit. There is no home-PC CI, UI, merge or deployment result.
