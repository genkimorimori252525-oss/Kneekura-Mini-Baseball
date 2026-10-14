# Live-appeal import: sharing within existing read proofs

Qualified source commit: `2d5b65a7b54ac4ce8cc91cd3288739b61cb866bc`.
Source tree: `5ca60ca85daafc4f70b2a8bcd6f44491ffa0208a`.

The previous measured optimization completed one historical CatchWork read in
230.227 seconds, compared with 588.335 seconds before those changes. This does
not measure a journal import. In the unchanged R15 run, initial authentication
finished and the first import entered at 2026-10-14 00:51:34.612 UTC; it was still
unreturned after approximately 44.5 minutes at 01:36 UTC.

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

## Measurement still pending

The planned comparison uses independent copies of the same accepted R12 cp16,
the exact accepted import Source and `deriveEvent(source, null)` inside the
existing SQLite read transaction. The harness adds no SamePa scope. It compares
the complete admitted return, database bytes/schema, restored connection state
and operation wall/CPU time. Materialization is outside the timer.

Each version has a finite 7,200-second ceiling and runs serially, alongside at
most the existing fixed R15 lane. An incomplete baseline provides no speed ratio
and does not authorize repeated attempts. R15's broader `acceptEvent` duration
cannot be substituted for this smaller read's baseline. No additional speedup
is claimed yet; R15 remains on its original fixed source.
