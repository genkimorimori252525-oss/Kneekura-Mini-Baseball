# Live-appeal import: sharing within existing read proofs

Production source: `2d5b65a7b54ac4ce8cc91cd3288739b61cb866bc`.
Production source tree: `5ca60ca85daafc4f70b2a8bcd6f44491ffa0208a`.
Retained-entry source tree: `9e498c7bce20ae015dfa43f2846c95e236b82aa2`.

## Repeated work and implementation

Static expansion of a successful revision-zero import identifies twelve seed
derivations, five additional field-rule-pair reads and fifteen direct physical
operation reads. These are source-derived counts, not a runtime profile.
Previously, the journal's BattedWorld proof did not keep the SamePa phase alive
between adjacent readers, so their completed proofs were discarded.

The direct live-appeal reader keeps its Native/transaction checks and
missing-reserved return first, then shares its five sequential reads within one
existing lifecycle phase. Each journal proof enters that phase only for a
Native connection already in a transaction, inside its existing BattedWorld
bracket. Prepare-only databases and calls outside a transaction retain their
previous behavior.

All twelve seed calls remain in five independent proof groups, containing
3 + 3 + 2 + 2 + 2 calls. Preflight completion, BEGIN IMMEDIATE, accepted Source
callbacks, insertion/head CAS, postwrite admission and independent retries remain
separate. Current/historical keys, full references, connection checks, private
savepoints, mutation detection, frozen results and failure poisoning remain.

## Consolidated qualification

Independent source review is CLEAR. Full compiler passed in 38.259 seconds.
All 86 declared cases in seven relevant files passed in 10.981 seconds, with
exact names, no skipped/pending/todo cases and unchanged source, dependency,
runtime and control inputs. The selected cases cover immutable sharing,
current/historical mode, independent invocations, query-only restoration,
legacy behavior, current rejection, authority callback changes, rollback,
reopen and warm ATTACH rejection. Unchanged hold/TAKE/HistoricalView code
retains its previous qualification.

## Matched read measurement

Each version ran once against an independent copy of the same accepted review
input, using the exact import Source and deriveEvent(source, null) inside the
existing SQLite read transaction. No outer SamePa phase was added by the
benchmark. Input preparation, DB opening, serialization and schema checks were
outside the operation timer. Another fixed verification case was active during
both measurements; equal external contention was not established.

| Version | Operation wall seconds | Operation CPU seconds |
| --- | ---: | ---: |
| Previous optimizations, src b8cd9c0d | 1425.839 | 1430.480 |
| This change, src 5ca60ca8 | 221.895 | 223.130 |

Wall and CPU time both decreased 84.4%; the wall-time ratio is 6.43.
Both complete admitted returns contain 68,481 JSON bytes and match byte for
byte, including root, previous projection, new value and admission evidence.
Canonical SHA-256 is
`9dd6157ee0ddf45defcc010a787d680ff1ed4d8eeb5bd643843bd92c1975462f`.
Database bytes/schema remained unchanged, the transaction closed and query_only
was restored. Source, dependencies, runtime and benchmark inputs stayed fixed.
The 7,200-second measurement ceiling did not trigger.

This is one successful read per version. It does not establish a whole-owner,
whole-case or remaining-time forecast. The broader import writer on the prior
source returned committedChange=true after 6,267.968 seconds; that different
operation is not the read benchmark's baseline.

The preceding three changes independently measured the same historical
CatchWork read at 588.335, 492.347, 388.349 and 230.227 seconds. Complete
19,442-byte returns matched and DB bytes stayed unchanged. That 60.9% cumulative
reduction is also limited to the measured read.

## Exact retained import boundary

Fixture source `18517c9f43df25236ec4bcb78ea4947cd8fc939e` adds an exact
import-accepted entry to the existing retained loader. It authenticates saved
Source, admission, projection, head and revision before starting original rights.
The revision-zero entry still rejects this later state. Modified Sources,
duplicate imports and later states are rejected. Completed import assertions
are checked from accepted evidence, and the unchanged remainder retains four
journal calls and seventeen terminal calls. All twenty original callback
assertion bodies remain intact. This entry needs no production code changes.

Independent review is CLEAR. Full compiler passed in 38.148 seconds and all
23 selected cases in RetainedCheckpoint, RetainedReviewSessionSeam and
RetainedReviewImportSeam passed in 7.351 seconds. Exact case inventory matched,
with no skips and unchanged source, dependency, runtime and control inputs.

The saved input contains the accepted import. Rights are pending and Match has
zero official outs. Execution was interrupted by the environment before the
remaining original case completed. The new retained entry has not completed
Native authentication. The interruption is neither a successful continuation
nor a demonstrated functional failure. Existing successful results retain their
source attribution; the complete case remains unverified.
