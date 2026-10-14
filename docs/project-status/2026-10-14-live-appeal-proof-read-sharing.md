# Live-appeal import: sharing within existing read proofs

Qualified source commit: `2d5b65a7b54ac4ce8cc91cd3288739b61cb866bc`.
Source tree: `5ca60ca85daafc4f70b2a8bcd6f44491ffa0208a`.

The previous measured optimization completed one historical CatchWork read in
230.227 seconds, compared with 588.335 seconds before those changes. This does
not measure a journal import. In the unchanged R15 run, initial authentication
finished and the first import entered at 2026-10-14 00:51:34.612 UTC. It returned
at 02:36:02.580 UTC with committedChange=true, taking 6,267.968 seconds from
entry to return. Its first checkpoint preserves the accepted import; rights and
all later original operations remain pending. That broader writer time is a
separate measurement from the read comparison below.

## Concrete repeated work

Static expansion of a successful revision-zero import identifies twelve seed
derivations, five additional field-rule-pair reads and fifteen direct physical
operation reads. These are source-derived counts, not an observed runtime
profile. Previously, the journal's BattedWorld proof did not keep the SamePa
phase alive between adjacent readers, so their completed proofs were discarded.

This batch retains all calls and groups immutable reads at two existing boundaries:

- `readPostPlayOriginalLiveAppeal` keeps Native/transaction validation and the
  missing-reserved return first, then shares its seed, pair, execution,
  indication and throw-plan reads within one existing lifecycle phase.
- The journal's existing `proof` enters that phase only for a Native connection
  already in a transaction, inside its existing BattedWorld bracket. Prepare-only
  databases and calls outside a transaction preserve their earlier behavior.

The twelve seed calls remain in five independent proof groups, containing
3 + 3 + 2 + 2 + 2 calls. Preflight completion, `BEGIN IMMEDIATE`, accepted Source
callbacks, insertion/head CAS, postwrite admission and independent retries remain
separate. Current/historical keys, full references, connection checks, private
savepoints, mutation detection and failure poisoning remain in force. A repeated
current prefix can reuse its authenticated result within the same immutable
phase; this does not mean every lower-level census runs again on a memo hit.

## Consolidated qualification

Independent source review is CLEAR. Full compiler passed in 38.259 seconds.
All 86 declared cases in seven relevant files passed in 10.981 seconds, with
exact names, no skipped/pending/todo cases, unchanged source/dependency/runtime/
control pins and complete process-group cleanup. One new composition case and
the existing read-boundary cases cover shared reads, current/historical mode,
fresh independent invocations, frozen returns, query-only restoration and legacy
fallbacks. Existing journal/closure and phase/field-rule cases cover current
rejection, authority callback changes, rollback, reopen and warm ATTACH rejection.
Unchanged hold/TAKE/HistoricalView implementations retain their previous
qualification; their full suites were not rerun for this composition change.

Receipt SHA-256: `e98643f3080ef4673a950971411e1fe74fc4867816ff5620169e8f879e706cf1`.
Formal report SHA-256: `1ff1fc8e7f32214caba2fd9ddb47a64894ba51b353f16d9de606caaddccf1c8b`.

## Matched read measurement

The comparison completed once per version on independent copies of accepted
R12 cp16. Both used the exact accepted import Source and
`deriveEvent(source, null)` inside the existing SQLite read transaction. The
harness added no SamePa scope. Materialization, input validation, DB opening,
result serialization and schema checks were outside the operation timer.

| Version | Operation wall seconds | Operation CPU seconds |
| --- | ---: | ---: |
| Previous three optimizations, src `b8cd9c0d` | 1425.839 | 1430.480 |
| This batch, src `5ca60ca8` | 221.895 | 223.130 |

Wall time decreased 84.4% (6.43-fold ratio); CPU time decreased 84.4%. Both
complete admitted returns contain 68,481 JSON bytes and match byte for byte,
including root, previous projection, new value and admission evidence. Canonical
SHA-256 is `9dd6157ee0ddf45defcc010a787d680ff1ed4d8eeb5bd643843bd92c1975462f`;
raw JSON SHA-256 is `94a92e1b42c852c021a529c93f85165e56ca43edda7f06029f0cdaf411a62a2a`.
Database bytes/schema stayed unchanged, transactions closed, query_only was
restored, all six pin groups stayed unchanged, and both process groups were
fully reaped. The 7,200-second ceiling did not trigger. The candidate started
only after the baseline completed with cleanup; the fixed R15 was the sole
other Native lane.

Comparison receipt SHA-256:
`6df854705b21fab369fb74882f7893d32cef7fe1ed79e10afbc9bbf9ec7a20f9`.

This is one successful read per version. R15 was active during both samples;
its work and external contention were recorded but not controlled. R15's full
`acceptEvent` duration is not this read's baseline. The measured reduction does
not establish a whole-owner, whole-case or remaining-time forecast. R15 remains
on its original fixed source; completed operations will not be repeated when a
later retained boundary is used.
