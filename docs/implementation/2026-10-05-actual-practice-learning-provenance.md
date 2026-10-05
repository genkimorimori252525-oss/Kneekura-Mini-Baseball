# Actual practice to accepted pitch-timing learning: bounded next slice

Status: the implementation passed 28 adapter cases, 59 affected existing cases,
and the full compiler on both its author source and the later combined repository
base identified below. No new numerical model.

## Goal and existing contracts

Authenticate a final accepted pitch-timing learning input against actual practice
and two distinct consumed measurement probes per original episode practice event.
Preserve the existing `AcceptedPitchTimingLearning` four-field DTO and existing
Core source-change/exposure formulas. `SqlitePlayerPitchTimingStore.apply` remains
the only capability writer. No Club rating, lineup or attendance write is needed:
future physical delivery already selects its timing source from that owner.

Authority is the approved nonvisual recovery checkpoint and frozen Foundation
`44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, doc53 §§2,9,28(29), doc55 §§5–8.
Document32 supplies no authority. Doc53 leaves calibration work open; it does not
specify a fatigue-normalization estimator. This slice adds an explicit accepted
input boundary and makes no claim of completed empirical calibration.

Existing sources:
- `SqlitePlayerPitchTimingStore.ts:29–40`: accepted final learning authority/DTO
- `PlayerPitchTimingSource.ts:12–16,95–159`: one standardized pair per episode
  practice event, exact coverage, then existing median-based source projection
- `SqlitePlayerWorkloadRecoveryStore.ts:239–267`: historical BEFORE-fatigue and
  accepted health binding; caller estimates cannot replace them
- `DevelopmentPracticeExposure.ts:12–35,74–178`: explicit policy/prior/factors,
  consolidated-only exposure gate
- `DevelopmentLearningEpisode.ts:96–209`: feedback/consolidation stage policy
- `PitchFatigueExecution.ts:29–64`: forward temporary response with integer
  rounding; it is not an inverse standardization API

## Prospective plan and explicit accepted report

A versioned prospective pairing plan names:
- Original episode ID/revision and original PRACTICE source event/completion
- One distinct future NORMAL opportunity Source and one distinct future QUICK
  opportunity Source, both explicitly `episode: null`
- Protocol Source/version, acceptance provenance and applicable reference frame
- Explicit condition-comparison mode; first supported mode rejects mismatches

The plan is accepted before either probe begins. Freeze both prospective accepted
opportunity payloads and versions, not only their IDs; probe admission checks the
frozen command and protocol membership before creating the attempt. A changed
Source or mode must fail before physical execution, rather than merely invalidate
a later measurement. Bind admission order within the same practice owner; do not
infer global World time. Probe opportunities stay
ordinary actual attempts: all five phases must be consumed and each effort/health
assessment and PRACTICE workload must commit. Both probe records remain intact.
QUICK admission authenticates its own paired NORMAL completion and workload
receipt, independently of whether unrelated activities reached QUICK's quoted
revision. Reservations bind both Source ID and canonical opportunity identity.
Neither probe may also be an episode repetition for this protocol, and no attempt
or pair may be reused by another measurement plan. Original learning practice and
two measurement probes therefore retain three actual workload records and one
original episode practice event. No workload aggregation or second charge.

A separate explicit versioned accepted measurement/normalization result binds:
- Plan/protocol Source and version
- Both exact completed attempt references and immutable frame hashes
- Both raw timing observations and exact BEFORE-workload/health references
- Standardized NORMAL and QUICK durations
- Measurement/normalization Source version and calibration provenance

Preserve the raw observations. Never fill standardized values from raw durations,
zeros, the current timing profile or a replayed command. The configured source
owns the accepted standardization result; the adapter validates its exact binding
and declared protocol conditions. No default correction coefficient or estimator.
The existing accepted-learning authority remains the final numerical source;
its per-event measurement must exactly equal this accepted bound report.

For a comparable-condition/identity protocol, both probes must match the accepted
reference body/release, timing, nominal physics, fatigue-response policy and exact
BEFORE-fatigue value. Workload revisions, mode, random draw and local execution
time remain distinct recorded provenance. If sequential effort changes fatigue,
reject comparability unless genuine accepted recovery actually restores the
reference condition. A day change is not recovery. Supporting unequal conditions
requires an explicitly supplied versioned normalization protocol/result; no
silent inverse fatigue calculation is permitted.
For same-day probes, authenticate every intervening workload receipt and require
the sum of actual RECOVERY durations to fit the local interval from NORMAL's
consumed follow-through to QUICK's ready time. Convert hours to microseconds with
finite/overflow checks. This is a necessary local interval check, not a global
World scheduler or a day-length conversion. Cross-day probes retain explicit day
ordering and the same strict reference/fatigue comparison.

## Assembly and durable ownership

Reuse the existing attempt owner for small durable pair-plan/result/request
intakes if its transaction model fits; these records are references to already
owned executions, not new completion receipts. Keep physical authentication free
of learning-intake reads. There is no need for another generic final-learning
store or another capability engine.

The new adapter reads `AcceptedPitchTimingAuthority.readAcceptedLearning`, then
checks the exact consolidated episode, unique original practice-event coverage,
real original attempts, their workload receipts and the exclusive standardized
pair report for every event. Require all existing practice policy/prior and
trainingStimulus/coachingFit/challengeFit/motivation/opportunity/novelty inputs.
Use the existing workload binder for fatigue/health, and reject any differing
accepted DTO values rather than silently rewriting an accepted request.

Freeze the final accepted source, proof references and expected timing revision
before intake. Missing final accepted input, reports, feedback or consolidation
remains a named pending condition. A supplied consolidated DTO with missing,
invalid or insufficient exposure fails the existing Core validation before its
first request or report reservation is written; corrected accepted input can
subsequently succeed. Validation errors are never converted into pending.
No hypothesis/feedback/consolidation or adaptive source
change is generated merely to finish the adapter. First-write stale revisions
reject; exact completed retries use the same durable original application.
Each report is reserved by one final learning Source even while its request is
pending. A second Source cannot claim the same evidence before the timing writer
runs; reads also reauthenticate this exclusive ownership.

The existing timing consumer needs an optional caller-connection evidence guard
on adoption, written rows, retry and durable reads. Original source mutation in
that transaction must roll back the timing event and head. Existing generic
callers and DTOs remain compatible.

Authentication must decrease by timing revision. The current timing store's
`readHead` and day selectors replay the entire head, so a new timing read guard
could recurse back through the practice attempts that used its BEFORE revision.
Write the cycle regression first. If demonstrated, add one exact historical
source-prefix read to the same timing owner, validating only the required earlier
baseline/update prefix for proof authentication. Do not suppress guards or use
today's source as the old frame. Fresh write admission still checks the current
head; the prefix read is for frozen earlier dependencies.
Practice timing providers now supply `selectAtRevision` alongside `readHead`;
custom providers that previously supplied only `readHead` need that exact-prefix
method. All existing repository constructors use the Native owner that supplies
it. `apply` remains optional for a physical-only provider and is required only
when adopting accepted learning. Existing timing DTOs and numerical rules remain
unchanged.

## Bounded source and test changes

1. New `src/host/world/ActualPitchTimingLearningFromPractice.ts`: contracts,
   provenance assembly and named pending outcomes; no normalization arithmetic
2. Extend `SqlitePitchPracticeAttemptStore.ts` with versioned prospective pair,
   accepted report and learning-request intake/read APIs in the same owner
3. Extend `SqlitePlayerPitchTimingStore.ts` with optional evidence guard; introduce
   an exact earlier-prefix source read only after the recursion regression proves
   the existing full-head selectors insufficient
4. New `ActualPitchTimingLearningFromPractice.test.ts` plus a genuine small SQLite
   fixture support file, reusing actual consumed practice attempts
5. Update the implementation/status documentation only with observed results

RED cases before implementation:
- One original attempt and two consumed probes produce exclusive bound evidence,
  keep all three workload records, and preserve one episode practice event
- Missing/unfinished/wrong-mode/foreign/late-plan/reused probes fail before intake;
  a changed frozen prospective command rejects before creating a physical attempt
- Different BEFORE-fatigue/reference frames reject; days never reset fatigue
- Changed plan/protocol/version/completion/frame/report or standardized values
  reject; raw observations survive unchanged across reopen
- Missing report/final source/feedback/consolidation leaves timing pending;
  supplied invalid or ineligible factors reject without poisoning corrected intake
- Every episode event has exactly one unique report; no duplicated pair, exposure
  or workload and no reuse across learning sources/episodes
- Historical workload evidence survives later real recovery and source changes
- First-write stale timing rejects; original retry after later updates is exact
- Actual no-change standardized evidence preserves NO_SOURCE_CHANGE; changed
  measurement fixtures exercise only the already existing source formula
- Direct timing read, second application and reopen never self-recurse
- Original proof corruption and writer-local mutation roll back event/head

Synthetic accepted report/calibration fixtures must be labeled as such. Passing
these tests proves authentic adoption of explicitly accepted measurements, not
autonomous feedback, adaptation or empirical calibration. Existing pitch timing,
workload, learning, exposure and downstream physical-runtime tests remain the
adjacent gate. No tests/compiler run is included in this design step.

## Test-first interface details

`createActualPitchTimingLearningAdapter` is the proposed absent module entry point.
Its facade delegates durable plan/report/request ownership to the same practice
store. Existing construction stays compatible through optional accepted pair-plan,
standardized-report and final-learning providers. Reopen reads original intakes
without live providers; the facade does not open another generic learning database.

A QUICK command may quote a future workload revision after NORMAL and genuine
accepted recovery. Plan acceptance freezes that prospective command and reserves
both canonical attempt identities; it must not require the future revision to be
today's head. Exact freshness is enforced at each probe's actual begin. Reservations
use career/opportunity/ordinal identity, including Source aliases, and reject
already-started probes atomically. A plan alone does not reserve an unfinished
physical body or block unrelated legitimate opportunities.

The original episode revision identifies the historical prefix containing the
original practice event. Final accepted learning references its later consolidated
revision. Legitimate feedback/consolidation may extend the prefix. A pending
request freezes its identity, proof references and expected timing revision; it
must not fabricate or freeze a partial final DTO. Final numeric content is frozen
only on valid accepted intake, and a changed accepted final Source requires a new
explicit identity/version.

The historical-cycle regression applies to practice capture itself. Adding a
timing-prefix accessor while retaining an unconditional timing.readHead call in
historical capture would still recurse. Frozen physical/probe/priorClock proofs
must use the earlier-prefix path directly; fresh physical admission keeps current
head checks.

The proposed fixture uses the genuine practice owners and adds only call-through
source hooks. It imports the absent adapter after one actual practice and workload
settlement, with cleanup already registered. Standardized reports, exposure,
recovery and final feedback/consolidation inputs are labeled synthetic acceptance
fixtures. This preparation preceded the implementation and verification record
below.

## Initial RED and implementation checkpoint

On exact test-only commit `9c195ec`, all 21 tests reached the absent adapter module
after genuine fixture setup; none were skipped. This establishes the missing
implementation boundary, not successful behavioral assertions. Independent source
review checked prospective revisions, actual recovery intervals, exact INSERT
witnessing, historical timing dependencies and whole-input immutability.

The implementation adds pair-plan, canonical probe-reservation, accepted-report
and pending/final-request records on the existing practice owner's connection.
There is no additional database owner or numerical standardization model. Final
values remain explicit accepted inputs and are checked against their immutable
report/protocol/attempt bindings. The existing exposure and timing formulas remain
unchanged.

The timing consumer now supports optional write/written/read/retry proof checks
and an exact earlier-revision prefix reader. Historical practice capture uses
that prefix directly; fresh admission retains current-head checks. Proof reads
have an upper timing-revision boundary, including prior physical dependencies.
Source review and the first GREEN/compiler run for this adapter are still pending.


## Verified implementation and limits — 2026-10-05

Verified source: `dfbcb644516b448b74cf1ddaa1e15458399627a2`, source tree
`798627a4bc83a9766cbc1b5a2ea7d5562743de9f`. The generated catalog check, all
87 selected cases, and the full TypeScript compiler passed on Node 26.10.0:

- Actual practice learning adapter: 28/28 cases, 175.830 seconds
- Affected existing owners and models: 59/59 cases, 18.240 seconds
- Full compiler: 37.512 seconds

The affected selection comprises the existing practice owner (49), durable timing
owner (2), Core timing source (5), workload-bound delivery (2), and Player delivery
(1). There were no skipped cases. The two test groups produced independent final
JSON reports, preserving the same complete 87-case selection. Aggregate RSS
peaked at 382,664 KiB for the adapter, 397,156 KiB for the affected tests, and
1,371,068 KiB for the compiler. All processes exited and were reaped; source,
control and runtime hashes remained unchanged. The source manifest hash is
`e9bb356bd98a067ba1922e3fabd6683538b4f40a8b4d6a0608dfcdb95ee1ee50`; the
combined terminal receipt hash is
`295ff6dd580a33742d9f8efe87ae41e1e900e523d3d72359aae87990240ca40c`.

Earlier evidence stays distinct. The first 21-case RED observed the missing
adapter module after genuine fixture setup. Independent source review then led
to six focused behavioral RED failures for reservation identity, NORMAL-before-
QUICK causality, same-day recovery duration, and pending/ready report reuse. That
focused run deliberately excluded 21 other cases. A 90-second full review attempt
and a later 180-second combined GREEN attempt were interrupted by their wall
limits; neither is counted as a completed verification result. The final split
run above completed the entire selection without changing source or assertions
to avoid those limits. Independent source review found no remaining concrete
implementation defect; the final exposure-rejection contract and corrected-intake
regression also received source review before the completed run.

This verifies adoption of explicitly accepted, versioned inputs. A real original
episode practice and both real probe deliveries consume their physical phases
and keep separate PRACTICE workload records. The accepted protocol, standardized
measurement/calibration result, exposure factors, feedback and consolidation
remain required external facts. Raw timing is preserved as observation and never
promoted into a standardized measurement by this adapter. The comparison protocol
rejects differing reference conditions; genuine accepted recovery may restore
BEFORE-fatigue, with the additional same-day local-duration bound.

The slice does not generate practice opportunities, a normalization estimator,
empirical calibration, feedback, consolidation, or automatic capability gains.
The existing timing owner alone adopts the supplied validated numerical evidence
and retains both `NO_SOURCE_CHANGE` and its existing source-change behavior.
Actual opportunity generation and production measurement/calibration providers
remain separate follow-on connections. No Club, lineup, attendance, Match or UI
state is manufactured.

## Verification on the current combined source

The fixed integration commit `98a96fdeaa93ff5fabd2560f3596594134981840`
contains the previously published official continuation changes and this adapter.
Its complete source tree is `1fea871c442aa02b84291baa3778f1bd367dd02f`;
the tested full tree is `49530c3140aa39e1eba5ec64d67e6db130ec6e2c`.
Publication adds documentation only after this gate.

On 2026-10-05, Node 26.10.0 ran the following serialized stages:

- Catalog consistency: PASS
- New adapter: 28/28 cases, zero skips, 180.830 seconds, peak process-group
  RSS 387,668 KiB, observed heap limit 480 MiB
- Affected existing practice, timing and physical-runtime behavior: 59/59 cases,
  zero skips, 29.868 seconds, peak RSS 397,096 KiB, heap limit 480 MiB
- Full repository TypeScript compiler: PASS, 47.299 seconds, peak RSS
  1,330,120 KiB, heap limit 1,504 MiB

All four stages exited zero. Source, head, controls and runtime were unchanged;
all owned processes were reaped. The source manifest SHA-256 is
`bead66bd699b6573048ff8812f28d3be624c220c8c4e552cf98d2d4a73944046`;
the raw terminal SHA-256 is
`97590d2f2b678f7fc649433a86018101f413fc7ebabed22563fbb2c5209530a4`.
These hashes identify retained verification evidence, not a public database upload.
This focused gate does not replace the pending cumulative regression or establish
autonomous production measurement, opportunity generation, or a complete Career.
