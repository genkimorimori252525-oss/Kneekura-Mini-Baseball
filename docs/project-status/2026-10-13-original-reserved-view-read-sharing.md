# Original reserved-view sharing within the existing continuation phase

## Repeated work and scope

`readHistoricalSamePaExecutionView` reconstructed its actor, original participant
states and complete prefix/TOTAL/view records for every public call. Its private
maps lasted only for that invocation. Continuation's private `emptyViews` map
covered one callsite; direct physical-right, second-TAKE setup and batting
perception callers bypassed it. Physical launch replay also explicitly rederives
its right, reading that same original view again after the right record was read.

The public historical reader now shares only its fully authenticated, recursively
frozen result through `memoSamePaContinuationRead`, keyed by the complete cloned
reference. The whole public call joins `withSamePaContinuationReadPhase`.
Existing actor and generic readers are unchanged. Current admission, physical
right rederivation and all writer protocols remain at their original callsites.

## Proof boundary

Each call still performs Native/query-only and full-reference validation, its
private signature/savepoint checks, reserved-storage and claim checks, and its
post-result check/release/finally cleanup. The memo lookup is inside that local
proof, after storage and claim checks. A failure after a completed lookup expires
the enclosing continuation phase, even if the caller catches it. Input failures
now also retire that enclosing phase.

The original-main-owner guard runs before every lookup. This preserves transitive
ATTACH/TEMP rejection on occupied/National origins and strengthens that boundary
for origins whose earlier path did not invoke it. Invalid-connection error text
may now come from the outer continuation phase. No exact error-text compatibility
is claimed.

Only successful completed results enter the existing memo; private mutable maps
do not escape. Mutation, rollback/rebegin, commit, failure and independent retry
retain the existing phase isolation. No persistent cache, caller-supplied proof,
new authority callback or expanded writer scope is introduced.

## Validation and measurement boundary

Two cases extend the existing HistoricalView fixture: complete-reference sharing
across lifecycle children, frozen output, separate operations and rejected changed
references; and warm ATTACH rejection followed by a fresh retry. The first also
injects one late private-savepoint RELEASE failure after a completed hit and
checks that the outer phase expires. Earlier actor authentication is the existing
fixture's explicit mocked boundary; Native rows, workload history and historical
reader proof checks remain real.

Development runs observed the two pre-change failures and then both selected
cases passing. The final late-savepoint extension passed separately. RED and
GREEN briefly overlapped because GREEN started before the RED exit receipt was
collected. Their test intervals overlapped by 9.030 seconds; exact process overlap,
maximum RSS and a separate child-process census were not recorded. All three
author sessions subsequently returned terminal receipts. These runs are excluded
from performance comparisons and formal qualification evidence.

The consolidated finite scope is the previous 134-case, ten-file batch
plus `SamePlateAppearanceHistoricalView.test.ts` (nine cases including HI09/10)
and `SamePlateAppearanceHistoricalViewWal.test.ts` (one), totaling 144 cases in
12 files. The existing continuation cases already cover mutation, temporary
schema, commit/rebegin, cycles and fresh scopes; no duplicate matrix was added.
On source tree `abb58d1dea9b3acd2caa6ea5e5b40e181a342bcc`, independent review is
CLEAR. The central full nonvisual integration compiler passed in 42.031 seconds
and all 144 declared cases passed in 212.157 seconds, with exact names matched
and no skipped/pending/todo cases. Source/runtime/dependency/control pins stayed
unchanged, no resource guard fired, and both process groups were reaped with
empty remaining censuses. The finite cap was explicitly reviewed at 360 seconds
for these existing historical fixtures; compiler, heap/RSS and reserve bounds
were unchanged. These central runs began after the three author primary sessions
returned. Earlier cross-namespace child cleanup is unknown and is not inferred
from a later visible-PID census.

The combined qualification SHA-256 is
`ca8e51e9a2ae6e142941fc5d3efc4004aec3c8ceedb9e232694dd72b6322641f`;
the formal test report SHA-256 is
`68c964a185c01df8a32a663eb2caf1d90aa07771bb50893fef108ae0a18def23`.

The saved cp11 sealed CatchWork operation completed in 388.349 seconds on the
previous qualified hold/TAKE source, with the full 19,442-byte return unchanged.
That completed result stays the fixed baseline. The coordinator's existing
comparison runs this candidate once on the same saved input and operation.
Repeated callgraph work is proven, but its runtime share and any incremental
speed improvement remain unmeasured. The fixed R12 source/run and the separate
fixture-only tail grouping proposal are unchanged.
