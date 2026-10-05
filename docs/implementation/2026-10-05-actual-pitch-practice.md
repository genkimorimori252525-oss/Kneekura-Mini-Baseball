# Actual pitching-practice attempt implementation plan

**Goal:** Execute one explicitly requested pitching-practice attempt through the
existing delivery model, then adopt its independently assessed workload and an
eligible existing learning-episode event exactly once.

**Architecture:** One new durable attempt owner retains prospective opportunity,
frozen Player inputs, consumed motion phases and execution-bound assessment. It
uses existing delivery/fatigue models, workload and learning owners; it does not
create a Match or a second development engine.

**Tech stack:** Existing TypeScript, Vitest and Node SQLite. No new dependencies
or CI configuration changes.

**Base:** `44b0401cf6f22aa154dbd2e420851652f41a28ef`.

## Authority and observed gap

- [Approved continuation](../project-status/2026-10-04-nonvisual-recovery-checkpoint.md),
  especially the actual-practice/capability boundary: caller-built accepted
  bundles prove adoption, not autonomous production.
- Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`,
  `docs/game-design/53-player-development-trajectory-breakthrough-v1.md`
  §§2 and 9: causal repetition precedes feedback, consolidation and source change.
- The same Foundation's approved
  `docs/game-design/55-pitch-release-geometry-v1.md` §§5–8: body-derived fixed
  release geometry; timing and nominal physical launch inputs remain separate.
- The same Foundation's
  `docs/superpowers/plans/2026-09-23-pitch-timing-cadence-quick-delivery.md`
  defines ready/start, motion/release and follow-through intervals and deterministic
  timing streams. Document32 supplies no implementation authority for this task.

`PlayerPitchDeliveryRuntime.resolvePlayerPitchDeliveryFromWorld` (lines 29–54)
and `CanonicalPitchDelivery` need no Match state. The higher WorkloadBound and
Continuous public wrappers require a plate-appearance timeline/batter; do not
fabricate those inputs. Reuse their underlying `applyPitchFatigueToExecution`.
The existing physical-progress/actual-role producers are game-bound and produce
MATCH workload. Administrative roster opportunities are not practice execution.

The resolver computes a future delivery DTO. The new owner must consume and
persist its phase prefix before declaring this bounded delivery complete. It
does not claim ball-flight/catch/collision or general full-body simulation.

## Global constraints

- Production source remains unchanged until an observed RED run.
- One Player, one prospectively accepted opportunity ordinal, one delivery.
- No default effort, health, timing, body, velocity/spin or fatigue coefficients.
- No Match/official fixture/plate-appearance creation, UI or new season engine.
- No PRACTICE activity until the delivery's consumed follow-through is complete
  and its exact effort/health assessment is accepted.
- No sampled command/replay may count as another attempt. Canonical attempt
  identity is career + opportunity + ordinal, independent of source aliases.
- Body-phase ownership is per career + Player across all opportunity IDs. A new
  opportunity cannot bypass an unfinished delivery or unsettled practice workload.
- Raw motion timing is an observation, never `PitchTimingPracticeMeasurement`.
- No generated feedback, consolidation, standardization, capability or Trait gain.
- Fresh writes preserve expected revisions; no automatic rebase of frozen intent.

## Existing histories to reuse

`SqlitePlayerWorkloadRecoveryStore.selectAtRevision` already validates historical
BEFORE state. Release `readHead` contains the accepted baseline and every ordered
change. Timing `readHead` contains every before/after timing change; its Core owner
changes only normal-motion duration and quick factor. Select an exact prefix from
that authenticated history, not a later same-day `selectProfileAtDay` result.
The episode owner likewise replays its accepted history; exact retry uses the
original expected revision and event identity. No new selector is planned unless
a failing test establishes that these existing histories are insufficient.

## Bounded files and interfaces

Create:

- `src/host/world/PitchPracticeAttempt.ts`: inert input contracts and pure phase/
  historical-prefix validation; reuse the existing delivery/fatigue models
- `src/host/world/SqlitePitchPracticeAttemptStore.ts`: the single new durable owner
- `src/host/world/PitchPracticeAttempt.test-support.ts`: genuine small SQLite
  fixture; synthetic accepted inputs; no Match store and no mocked delivery model
- `src/host/world/SqlitePitchPracticeAttemptStore.test.ts`: execution, workload,
  episode, replay, alias, stale-input and rollback checks

Modify only when proved necessary after RED:

- `SqliteDevelopmentInitiationStore.ts`: optional caller-connection evidence guard
  for adoption/read/retry, preserving the existing event DTO and generic callers

The opportunity authority supplies `sourceId/sourceVersion`, `opportunityId`,
`ordinal`, `previousAttemptId`, career/player/Person-link identity, `atDay`,
`readyAtUs`, exact workload/timing/release revisions, fatigue-policy Source ID,
an explicitly accepted practice RNG seed, timing intent, mound reference, nominal
velocity/spin and an optional existing episode target `{ episodeId, revision,
domain }`. A command authorizes an attempt; it supplies no completion receipt.

The assessment authority supplies its own versioned Source, exact completed
attempt reference/hash, effort units, health availability and independent
assessment/calibration provenance. Missing assessment is a named pending state.

The owner exposes:

- `begin(opportunitySourceId)` → immutable attempt with frozen frame, planned
  delivery and empty consumed phase prefix
- `advance(attemptId, expectedProgressRevision, throughUs)` → appended due phases;
  only consumed follow-through makes `DELIVERY_COMPLETE`
- `acceptAssessment(assessmentSourceId)` → exact completion-bound assessment
- `read(attemptId)` → reauthenticated original frame, phase prefix and assessment
- `readAcceptedActivity(activityId)` / `readAcceptedLearningEvent(activityId)` →
  existing owner DTOs only when their prerequisites exist
- `settle(attemptId)` → existing workload application, then eligible episode event;
  incomplete/assessment/learning states remain explicit pending results
- evidence guards used on consumer-owned SQLite connections and `close()`

Canonical activity ID is derived from the attempt identity. The learning owner
uses that same ID as both `advance` Source ID and event `sourceEventId`; aliases
cannot reuse one execution across episodes. New attempts must follow their
accepted predecessor and use the current workload revision. Later legitimate
changes do not rewrite an already accepted frame or completed receipt.

The owner keeps opportunity intake, progress and assessment provenance together;
there is no separate opportunity, measurement or learning-proof store. Consumers
retain their existing transaction boundaries. An interruption between them resumes
the same identities; it does not invent cross-owner atomicity.

The attempt record is `pitch_practice_attempts`, keyed by `attempt_id`; its
canonical `frame_json` pins the original authenticated input frame. Progress updates and consumed phase
history must commit together. The test-support contract defines the proposed
method/result fields, including raw timing and completion references. Practice
timing RNG uses a persisted practice seed, `practice:<opportunityId>` scope and
the accepted ordinal as logical indices; none is a Match/Play identity.

## Player ownership and clock scope

Admission, the Player ownership check and attempt insertion share one SQLite
write transaction. Only one attempt may retain unfinished delivery or an
unsettled PRACTICE workload for a career/Player, regardless of opportunity ID,
ordinal or requested day. Exact retry of that same attempt remains legal.
Consumed delivery plus its authenticated workload receipt releases this practice
reservation; an episode-only pending result does not reserve the body.

The new owner defines a local practice clock for each career/Player/day.
`atDay` selects the existing dated histories. `readyAtUs` and consumed phase
timestamps are microseconds in that local clock, not an existing global World
timestamp. All opportunities for that Player on the same day share this clock:
after a completed and workload-settled attempt, the next ready time must be at or
after its actual follow-through end. Equality is allowed; no artificial rest gap
is inserted. A later accepted day may begin at local time zero. Days are never
converted to microseconds, and advancing the day neither creates recovery nor
resets fatigue. Unfinished ownership still blocks a later-day request.

`previousAttemptId` and ordinal track the sequence within one opportunity; a
different opportunity starts at ordinal zero with no within-opportunity
predecessor. The owner independently checks the Player's prior attempt across
opportunities, so neither null predecessor nor a fresh opportunity can evade
ownership, chronology or workload-revision checks.

Admission pins `priorClock` from the actual completed predecessor across
opportunities: its attempt ID, day, follow-through timestamp, completion hash and
exact workload activity/revision. First-ever admission has no prior clock. Reads
and retries authenticate that original predecessor and its workload receipt;
they do not replace it with whichever attempt is newest today. Corruption of the
earlier clock evidence invalidates a dependent later attempt without changing
consumer histories.

This reservation belongs to the practice owner only. Cross-owner exclusion with
Match/other body controllers and a shared World scheduling clock require the later
real opportunity/scheduling connection; they are not established by this slice.

## Review focus

1. A planned future release must not become consumed completion without advance
2. Source aliases/replay must not add practice or charge workload twice
3. Later same-day timing/body changes must not replace historical frame inputs
4. Missing/future/foreign assessment or changed first-write revisions must fail closed
5. Writer-local source mutation must roll back consumer event/head writes

Cross-opportunity tests must also reject a second unfinished attempt using the
same workload revision, including later-day requests, then permit legitimate
same-day boundary and later-day opportunities without synthesizing recovery.

Physical attempt authentication follows frozen original inputs and strictly
earlier practice/clock dependencies. It must not replay the episode's current
history: that history may contain this attempt and invoke the practice guard
again. Learning authentication separately verifies the exact earlier episode
boundary. Guarded reads remain enabled; no recursion bypass or replacement of
the old BEFORE state with today's episode is permitted. A normal second-attempt,
reopen and direct episode-read/retry regression protects this dependency order.

## Task 1: Execute a durable delivery

- [x] Save this source-grounded plan and author the initial RED fixture/tests
- [x] Run the selected test file with one worker and record
  the exact expected missing-owner failures; fixture/type errors are not RED proof
- [ ] Implement only the prospective opportunity, pinned frame and consumed phases
- [ ] Verify begin has no actual release/workload; partial advance has no completion;
  completion requires every canonical phase through follow-through
- [ ] Verify deterministic replay, alias identity, ordinal/predecessor ordering,
  stale/future scopes, reopen, original-source corruption and transaction rollback
- [ ] Commit only with accurately stated verification status

## Task 2: Adopt assessed workload and eligible practice evidence

- [ ] Observe RED for missing/exact assessment, current expected workload revision,
  stale first write, duplicate charge and interrupted consumer adoption
- [ ] Derive the existing PRACTICE DTO from the completed attempt plus its explicit
  assessment; use the existing workload writer and writer-local evidence guard
- [ ] Emit PRACTICE_RECORDED only from its durable workload receipt and eligible
  existing HYPOTHESIS/PRACTICING episode/domain, with its frozen expected revision
- [ ] Preserve physical/workload truth when learning admission is pending; never
  generate a hypothesis, feedback or consolidation to make the request pass
- [ ] Verify later recovery/source changes preserve old attempt/event receipts;
  a distinct accepted attempt uses new workload state and can execute differently
- [ ] Run independent review, full compiler and explicitly budgeted adjacent gates

The initial test file will use a runtime import inside the fixture for the absent
new owner, so a missing module appears in a test invocation rather than as an
unrelated test-collection/type failure. No production placeholder is authorized.

## Later connection and stopping point

The accepted opportunity is currently an explicit upstream command, not an
autonomous practice scheduler. A later owner must issue real opportunities from
Player intent, availability, coaching/facility/time constraints and accepted
World/roster evidence. This slice must not infer practice from assignment or idle
days. The explicit assessment still needs a real effort/health provider; the
delivery result cannot manufacture those quantities.

Raw NORMAL/QUICK durations retain body/timing/fatigue/physics/seed provenance.
Paired standardized measurements need an independently accepted protocol that
identifies both actual executions and handles differing fatigue/conditions.
Repeatedly sampling the current capability is not adaptation. Feedback,
consolidation and genuine source-state change need their own actual evidence and
remain unimplemented by this slice.

Stop after one completed delivery can be replayed and adopted once into existing
workload and eligible practice-event history. Do not report this as autonomous
practice scheduling, general body generation or complete learning.

## Preparation checkpoint

The initial preparation contained 43 proposed cases. Its fixture used real SQLite
Player / Person, roster promotion, timing, release, fatigue, workload and episode
owners before invoking the then-absent practice owner. That preparation checkpoint
predates the implementation and observed verification recorded below.

Static review corrected the evidence-guard connection type and strengthened tests
for original-history corruption and direct episode read/retry provenance. Intended
initial RED is the missing practice owner reached during test invocation; setup,
schema or unrelated type errors must be resolved separately and cannot count as
behavioral RED evidence.

## Verification record

The first 43-case execution stopped in genuine fixture setup: the existing roster
catalyst compared JSON object key insertion order, rejecting the Native owner's
canonical stored event. Those setup failures did not establish producer RED.
A focused five-case Core regression first produced four passes and the intended
canonical-order failure. The minimal Core-safe comparison repair then passed all
five, retaining changed-value, extra-field and ordered-array rejection.

With that prerequisite repaired, all 43 practice cases reached the intended
missing producer import after real source initialization. There were no skipped
cases. The new producer implementation and optional episode evidence guard are
now implemented. The first review run passed all 43 original cases; subsequent
review repairs and final verification are recorded below.

Independent source review identified original-source transaction checks, copied
learning-receipt aliases and repeated traversal of earlier practice proofs. The
49-case review run passed 43 and failed six. Four failures directly demonstrated
timing-source rollback leaks, a copied receipt and repeated traversal (63 source
reads instead of six). Two release cases initially failed only because their
assertion omitted the existing release-history diagnostic. A test-only correction
then ran those two cases: both reached the intended original-row rollback mismatch;
47 other cases were deliberately excluded. These receipts remain distinct.

The repair retains immutable original physical source rows and exact revision
prefixes in the same attempt owner and checks them on the consumer's connection.
Episode-initiation/roster provenance is retained separately, outside physical
reads. Learning receipts must have exactly one canonical Source/destination, and
workload adoption verifies its exact archived BEFORE/activity/AFTER result.
Earlier physical and learning dependencies are memoized only within one
verification call on one connection; no cache survives to another consumer phase.
The proposed patch received independent source review with no new findings.
The committed repair was independently re-reviewed and matched the reviewed
proposal byte-for-byte, with no new findings. On exact commit `2ceb46e`, all 49
practice tests passed with no skipped cases in 23.513 seconds, and the full
TypeScript compiler passed in 29.775 seconds. Source and verification controls
remained unchanged through both stages. This is a focused producer gate; it does
not claim a whole-repository test run. Wider adjacent integration remains a
separate gate.
