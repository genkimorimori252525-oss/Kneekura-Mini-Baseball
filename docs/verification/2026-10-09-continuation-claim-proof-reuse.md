# Continuation ownership census reuse — 2026-10-09

The retained capture-cut profile's 18.88 seconds of second-TAKE replay was
cumulative ancestry cost across independent proof phases. Those calls already
use the lifecycle's completed second-pitch cache. Extending that cache across
effects would invalidate the existing freshness contract and is not done here.

Within those phases, successor discovery and later lifecycle work coverage
repeat the same complete continuation ownership census. The claim guard now
reuses only its completed frozen census through the existing Native immutable
continuation map. Scope filtering, player admission, release checks and work
coverage decisions still run independently. Mutable or non-Native callers
retain the original census path.

Every Native access checks the existing original-main owner guard before a
cache hit, including attached-owner and TEMP exclusions. The surrounding
phase checks transaction identity, query mode, changes, main/TEMP schema and
user version. A caught failure expires the phase, including ATTACH followed by
DETACH. Partial census construction never becomes reusable evidence.

## Bounded evidence

The baseline is frozen commit `2041dc15172158559d6eb99f5035dce26d889af2`, source
tree `ebaec2228a8cecbc13e6824a0c7240f2ec17ef40`. Separate consistent copies of
the preserved genuine pre-capture state ran the same initial capture-cut
operation. No fixture or full scenario was rebuilt. Both workers returned
normally within their 115-second cap and flushed their CPU profiles.

| Final guarded comparison | Baseline | Changed |
| --- | ---: | ---: |
| Complete operation | 30,606.28 ms | 30,422.48 ms |
| SQLite prepares | 232,430 | 216,400 |
| Continuation ownership censuses | 10 | 6 |
| Declared writes | 2 | 2 |

This demonstrates 6.9% fewer prepares and four fewer full censuses. The observed
wall-time difference is small; this is not evidence of a substantial runtime
speedup. Both returned the existing cut hash
`50039c3d1bccc4bdcb16e7169ed9cc231f09ade5dfd92ac974db03c9e9857522`, with matching
cut/head rows and identical complete persisted table/schema contents. An
earlier diagnostic without the added original-main guard is retained privately
and is not the final comparison above. All databases and profiles stay private.

## Focused checks

The new Native census regression first failed with two scans instead of one.
The final selection passed 5/5: four claim-reuse cases and the existing
continuation phase test. Together they cover independent/mutable reads, orphan
insertion between proofs, failed census construction, caught failure, DML,
schema mutation, transaction replacement, cycles, and attached-owner rejection
before reuse. All 18 protected blobs remain exact and `git diff --check` passed.
The assembled batch now has a passing full compiler, independent review and 185 passing cases in 17 files. See [the combined qualification](../project-status/2026-10-09-occupied-motion-attribution-batch.md) for the exact source and narrow reporter reconciliation. These checks do not qualify the remaining genuine Native scenarios.
