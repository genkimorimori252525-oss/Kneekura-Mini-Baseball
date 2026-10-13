# Field-rule pair sharing within an immutable read phase

## Problem and scope

The admitted-live-work reader derives a field-rule pair through the live-work
reader, then derives the same pair again. Fair-catch-end derivation adds another
identical pair. CatchWork also requests the original action's historical pair
through live-work and then directly. Existing lifecycle and physical record
memos already share lower-level records, but the field/rule projection itself
was repeated.

`readSamePaFieldRuleEvidenceWithInputsFromSqlite` now shares its completed pair
using the existing `memoSamePaLifecycleRead`. No other production function or
owner protocol changes. This is a structural reduction; no runtime speedup or
Native acceptance result is claimed before the same-input timing comparison.

## Proof lifetime

- The existing outer lifecycle read phase stays in place. Source cloning,
  reference/mode validation, and current/historical basis admission stay before
  the memo lookup. Catching invalid input still poisons the enclosing phase.
- The key is `field-rule-pair:` plus canonical JSON of `[mode, viewReference]`.
  The complete reference includes owner, Source identity and both hashes.
- An inactive-field pending result is not memoized. A thrown derivation cannot
  populate the memo. Only the completed frozen pair is shared.
- Pair/value/actor/view/physical records are immutable. The physical-record
  array is frozen. No authority callback, caller receipt or persistent cache is
  introduced.
- Existing Native/query-only, signature, savepoint, recursion and failure guards
  remain unchanged. DML/DDL, rollback/rebegin, commit, a new phase/connection and
  an independent retry must reauthenticate. Writer and post-commit proofs remain
  separate.

## Finite validation inventory

The existing field-rule evidence file adds three cases: exact pair/mode sharing
and fresh-phase separation; full-reference/invalid-input rejection with caught
failure poisoning; and pending-result non-sharing. Its synthetic baseball inputs
replace only archived reader boundaries. Pure field-rule calculation, the paired
reader, Native transaction and phase guards run normally. This is not Native
LAN acceptance evidence.

Central batch on source tree `ab5e2eaf2d26d98b32246d754493a612d9522cc2`:

- `SamePlateAppearanceFieldRuleEvidence.test.ts` (15 cases)
- `SamePlateAppearanceContinuationReadPhase.test.ts` (reuse existing mutation,
  temporary schema, commit/rebegin, failed proof, recursion and fresh-phase cases)
- `SamePlateAppearanceCatchReviewBoundary.test.ts`
- `ActualPostPlayReviewReadBoundary.test.ts`
- `SamePlateAppearanceFairCatchEnd.test.ts`
- `SamePlateAppearanceCatchCommunication.test.ts`
- `SamePlateAppearanceLiveWorkCensus.test.ts`
- Project TypeScript check

The full project compiler passed in 39.365 seconds. All 110 selected cases in
these seven files passed in 26.564 seconds, with no skipped/pending/todo cases,
stable source/dependency/runtime/control inputs and complete process cleanup.
Independent source and comparison-control review found no blocking issue.

The first strict inventory result remains false: the declaration collector left
out four single-quote pairs that Vitest adds when displaying `$name` strings.
The original declarations and installed formatter independently reproduce the
actual 110 complete case names. This reconciliation does not rerun tests or
change their source/outcomes. The combined qualification hash is
`c29849d194269c2ce7ebb8dd2274e5b049ebaa72a893115ff2621fbd0d7d15ad`;
formal test report hash is
`38851ea68cadd8cfa6641509d0ec0187af1721d05cfba5fe18996e02b70d758e`.

No Native prefix was regenerated and completed Native gates were not rerun.

## Same saved input timing entry

Use an independently restored copy of R12 owner checkpoint 11, where
`lan01:caught:work:sealed` has returned and cut24 has not been admitted. Compare
baseline and candidate in separate fresh Node26 processes, using the identical
saved gzip and complete CatchWork reference. Restore/check the saved receipt and
database hash outside the operation timer. Do not read the active run database.

The single operation is `withSqliteReadTransaction(db, () =>
readSamePaCatchWorkFromSqlite(db, sealedReference))`. Obtain the complete reference
from the copied saved row, then let the real reader authenticate it. Measure from
entry through successful return and transaction cleanup. Record the returned
canonical value/hash, ordinary JSON hash used by the saved owner journal, elapsed
time and database/schema immutability. The saved owner returned hash is
`feef196ce77c1a52597f2346fc1452a17709b67b837fd3ed074061510c320ddd`.
Both versions must complete the same operation successfully; call counts alone
are not a speed result. Current cut23 is not a valid substitute at this checkpoint
because the newly saved CatchWork is not yet in its lifecycle census.

Checkpoint 15 is a later alternative for one current admitted-live-work read at
the complete cut24. It covers a larger graph and is not needed for the first
bounded comparison. The coordinator completed one successful comparison per version on October 13:

| Same saved-input read | Baseline | Field-rule sharing |
| --- | ---: | ---: |
| Operation wall seconds | 588.335 | 492.347 |
| Operation CPU seconds (user + system) | 590.059 | 493.971 |
| Wrapper wall seconds | 588.657 | 492.703 |

The measured read saved 95.988 seconds (16.3%); CPU decreased 16.3% as well.
This is one paired measurement, not a distribution or whole-case forecast.
Both versions returned exactly the same 19,442-byte result file, with SHA256
`13926d7045da1234faf1463f9996414f651e3f422666733c2e0e601fd3c17787`.
Their canonical value matched the accepted database snapshot and hash
`b738ff317f3ad874122c2520c5833f9e97ab17b96e59da55ea339ce583c956b3`.
The ordinary returned JSON hash matched between the two readers:
`9defa24cb5d82fd19ba590c3156ba4f83e9ddf519adf9c6707e9d2b39ff881e4`.
It differs from the prior acceptance observer's raw hash; canonical equality
with the saved record and raw equality between these two reads are separate
claims.

Both database images remained byte-identical to the audited input. Both runs
closed their read transaction, restored query-only state, retained all four
input pin groups and reaped all children. Each used a fresh Node26 process,
identical heap/RSS controls and identical saved input; restoration stayed outside
the operation timer. R12 remained active throughout both runs. Its CPU heartbeat
progress is recorded, but equal external contention is not assumed. The visible
CPU quota file was unavailable, so quota equivalence is not claimed.
The comparison receipt hash is
`f304f82b86dc727a7799b0f8261ecf03d5461018a9af5c4c5bca4df6d39f9d9e`.

The next related optimization examines repeated immutable occupied-runner hold
and completed second-TAKE reads within the existing proof phase. Their time
contribution and incremental improvement remain unmeasured.

## Separate possible follow-up

The original shared tail makes independent live-work, field-rule and review-seed
read transactions. Combining only those preparations under one existing Native
read transaction and lifecycle phase could share ancestry across them. That is
a separate change with additional fixture/API scope; this patch does not do it.
Any such read group must end before `acceptSession`. It must not enclose journal
writes or supply cached proof to a writer, and must preserve the original
assertions and independent owner/retry authentication.
