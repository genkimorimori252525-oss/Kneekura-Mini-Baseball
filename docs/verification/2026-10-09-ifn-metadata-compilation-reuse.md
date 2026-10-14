# Same-PA metadata compilation in one existing read phase

The continuation read phase now opens the existing metadata statement scope for
its synchronous body. Continuation, lifecycle and dispatch claim discovery use
that scope for their raw-document metadata queries. Only compilation is reused:
the SQL templates, bindings, every query execution, schema checks, alias checks
and later owner replay remain unchanged. No row, metadata projection or completed
claim result is added to a cache. The existing Native query-only, signature,
savepoint and failure fences still govern the phase; its statement scope is
disposed on return or failure. Independent operations compile afresh.

## Completed original-operation comparison

Both runs accepted the same original IFN first capture cut from separate copies
of the genuine pre-cut database. The complete original main/empty-WAL/SHM tuple
was pinned and copied; only the owned copy was opened to make a closed backup.
No fixture, posture deadline or accepted declaration was reconstructed or changed.

Baseline commit `545e2301a64bc6a31f920d2ec056a79838b093a9`, source
`3554109fa2c0f878893fa44a1a7ef1ebf22290d2`, returned in 27.038 seconds.
Candidate commit `dd127711a50df238acdfec559ebfd2211df28c93`, source
`c6428dee76be592bc96e68f088dd171de6cefd35`, returned in 22.748 seconds.
This single pair is a bounded operation measurement, not a full IFN duration forecast.

- Total prepares: 224,008 to 202,748.
- The ten metadata query shapes: 21,320 compilations to 60 across six phases.
- All 21,320 metadata query executions remain identical by exact SQL string.
- Every other query's prepare count remains identical.
- Both returned the original result hash
  `50039c3d1bccc4bdcb16e7169ed9cc231f09ade5dfd92ac974db03c9e9857522`.
- Both called the accepted-source authority once and performed exactly one cut
  insert plus one head update. Full schema, every rowid and every stored value
  match; the closed database files are also byte-identical. All other original
  rows and schemas are preserved.

The same private driver and Native wrappers instrumented both runs. Each had a
90-second outer cap, 1 GiB old-space and 2 GiB RSS limit. Both exited 0 with all
source/dependency/runtime/control inventories unchanged and no surviving process.
The candidate ran after other author tests ended; no central compiler or Native
lane overlapped it. Private databases, profiles and control logs are not published.

## Focused verification

Two new Native mechanics cases failed for repeated compilation before the change,
then passed. They exercise the real structural lifecycle metadata reader, current
document execution, escaped duplicate claims, independent transaction freshness,
exceptional disposal and replaced savepoints. These structural fixtures do not
claim complete baseball ownership.

The seven affected files passed 46 cases, including existing mutation/restore,
DDL, nested/reentrant reads, WAL visibility, duplicate keys, aliases and failed
proof tests. A test-only overloaded observer delegation needed a type correction;
the final two cases and focused transitive TypeScript check then passed. The 18
protected blobs remain exact. No full compiler, fresh IFN fixture or whole-case
qualification was run in this bounded investigation.
