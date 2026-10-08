# Terminal foul TOTAL role workload: contract and test-first pack

Historical initial status (superseded by the focused candidate and repairs in
`docs/verification/2026-10-08-terminal-workload-qualification.md`): static preparation only. No project import, compiler, test, SQLite open,
physical producer, runtime, production implementation, or publication has run.
The coordinator must release a bounded test stage before any such execution.
An authored test is not an observed RED or qualified behavior.

## Authority and exact baseline

This implements the workload prerequisite within the existing approved nonvisual
foul plan, not its same-PA resume or future post-play completion capability.
Authorities are AGENTS.md; the October 5 owned-batting/same-PA foul plan; the
October 7 terminal pending and October 8 acknowledgement contracts; runtime
contracts §§9.5–10.4; and adjudication contracts §§9–10. The source-only next-step
proposal and sibling October 8 terminal deterministic scoring plan were read.

The isolated checkout starts at acknowledgement commit
`7484947441a91bd19e3da522b3b37b6f0bbd7110`, full src tree
`c507ae766bd988b894abf05aa3eaffab0b8322d3`. This selects the reviewed retained
acknowledgement copy helper. Its production bytes are unchanged from
`2a0b33242d8a094f595e516f4ce83d23d4c06bd0`; that earlier full src tree was
`801331b24872f3d9916da17d9a831bd3dba6d2e9`. Full src trees differ because tests
and support files are under src. Neither hash means this new slice ran.

## Concrete owner and accepted contract

Add only `ActualFoulTerminalRoleWorkloadAssessment.ts`,
`ActualFoulTerminalRoleWorkloadEvidenceFromSqlite.ts`, and
`SqliteActualFoulTerminalRoleWorkloadStore.ts`, with narrowly shared settlement
plumbing where required. The public opener is
`openSqliteActualFoulTerminalRoleWorkloadStore(path, personLinks, authority?)`.
It exposes `acceptAssessment(id)`, `acceptAssessments(ids)`,
`initializeBaseline(terminalSourceId, baselineSourceId)`,
`freeze(terminalSourceId)`, `settle(terminalSourceId)`,
`readSettlement(terminalSourceId)`, and `close()`.

The test-only proposed types in
`ActualFoulTerminalRoleWorkloadFixture.test-support.ts` freeze the exact API and
Source shape. They do not export production capability. The new Source has
capability `actual_foul_terminal_total_workload_v1` and references:

- the actual terminal owner, Source ID/version/hash, proposal hash, original
  official receipt hash, and exact acknowledgement hash;
- E as `actual_foul_play_ends`, with its original Source/version/hash/snapshot;
- E's whole-history hash and `owned_scheduled_whole_history_manifest_v1`;
- the complete ordered `originalPhysicalPitchPrefix`, including every original
  Source/version/hash/snapshot/progress revision;
- one original player plus exact binding/person hashes;
- independently accepted finite nonnegative TOTAL effort and explicit
  assessment/calibration Source IDs and versions.

The Source accepts no career, game, play, day, replacement Person, fatigue,
closure result, next actor, readiness, or caller-supplied baseline state. Scope
comes from the authentic proposal's ten original participants. Baselines remain
existing independently accepted Player workload baseline Sources/policies; new
baseline initialization must match that participant's exact original Person
link/career/player and valid day chronology. Missing inputs return pending;
corrupt or contradictory archives reject. Absence of baseline/policy is never
default zero. A frozen settlement losing its baseline/policy is corruption.

`foulTerminalRoleWorkloadContextFromSqlite(db, terminalSourceId)` is the sole
concrete context entry point. Every read and mutation authenticates the genuine
`OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY` through the existing terminal reader
on the actual writer connection. It authenticates P/C/E/journal, immutable
receipt/acknowledgement, pending Match/application mirrors, original participant
bindings/Person links, fixture and policies. Original P must remain
`batted_ball_pending`; composed terminal C is not substituted into P.

E's field history does not cover the physical pitches. The Source therefore
binds both E's manifest and the full prefix. Effort is TOTAL over that covered
PA, including pitching. Source equality must preserve prefix order and all
references; truncation, duplication, foreign prefix, wrong end kind or a next
lineup reject. The legacy first-base Source/type/reader remains exact and
rejects this terminal variant at runtime.

## Shared durable mechanics and exactly once

Reuse existing `actual_role_workload_assessments` and
`actual_role_workload_settlements` schemas and their career/game/play uniqueness.
For this explicit capability only, their historical `closure_source_id` column
contains the terminal Source ID. The payload has `terminalReference`, never a
fake first-base closure. Dispatch shared internal code by the exact capability;
do not broaden `AcceptedActualRoleWorkloadAssessment`, the old accepted-play
union, legacy writer entry points, or their serialized shapes. Legacy public
readers must explicitly reject terminal rows before legacy decoding.

Derive exactly the existing activity identity:
`actual-total-play-workload:` plus SHA-256 of canonical
`[careerId, gameId, playId, playerId]`. Keep sourceVersion
`actual-total-play-workload-v1`, `evidenceId = E.sourceId`, `kind = MATCH`,
`atDay = original gameDay`, and `effortUnits = accepted TOTAL` exactly. A new
assessment alias or terminal namespace never creates a second activity.

Retain bidirectional legacy-pitch/TOTAL exclusion before acceptance, freeze,
charge, read and retry. Extend the raw original-evidence fallbacks in
`ActualRoleWorkloadChargeGuard` to terminal/E references and surviving settlement
and assessment mirrors, including when a selected producer/assessment row has
gone missing. Inspect duplicate/escaped/array metadata without lossy JSON
parsing. Corrupt matching claims fail closed; unrelated scopes stay opaque.

Reuse `prepareActualRoleWorkloadSettlement` and the existing global Player
workload owner. Freeze all ten BEFORE states together, explicitly labeled
`capturedAt: settlement_freeze`. This historical fixture has no pre-work
reservation; do not relabel BEFORE as play-start or claim reserved execution.
Each participant charge retains the existing transaction/CAS boundary: real
activity INSERT and exact head update commit together. Partial settlement may
retain earlier committed charges; the failing charge and all its trigger effects
must roll back. Uncharged heads equal frozen BEFORE; charged histories retain
their exact AFTER prefix. Later separately accepted activities on charged
participants may remain, but no such input is manufactured by these tests.

For assessment batch/freeze/each charge, reauthenticate after acquisition and
after real writes on that connection. Pin raw dependencies and schemas and
check exact write accounting, including byte-neutral/mutate-restore/unrelated
writes, aliases and all ten current heads. A scoring row legitimately committed
before acquisition is unrelated valid data; do not freeze a cross-operation
whole-database snapshot as permanent authority. Detect in-transaction changes.
Retry/read/reopen must authenticate historical effects and perform zero writes.
Transaction replacement or failed rollback/restoration retires the handle.

The terminal opener validates existing v3 acknowledgement storage and exact
required shared layouts before invoking mutation-capable global setup. It does
not silently install/migrate arbitrary databases. The private test-copy helper
may add only missing canonical workload tables after genuine authentication;
it records the exact schema delta and preserves all existing rows.

## Boundaries retained

This is a workload prerequisite only. Terminal status, result, acknowledgement,
original P/C/E/journal, official application/receipt/revision, Match state and
pending marker stay byte-identical. Scoring remains independently owned and is
neither required nor produced by this adapter. Both next-play admission routes
still reject. No reset, controller retirement, recovery from elapsed time,
completion, next activation, changed timeline, legacy closure, or extra pitch
aggregate is introduced. Historical `ContinuousPlayerPitchRuntime` effort and
policy bytes/calculations remain unchanged; its temporary execution fatigue is
not another global charge.

## Test pack and execution order

W01 is the genuine missing-adapter RED: copy only the pinned acknowledged A01
artifact via the reviewed retained helper; authenticate current P/C/E/journal,
receipt/acknowledgement/mirrors and ten participants before dynamically looking
for the new context/store. The missing API assertion is
`GENUINE_ACKNOWLEDGED_TERMINAL_WORKLOAD_API_MISSING`. Import, fixture or evidence
failures are not RED credit. Once implemented, W01 proves absent assessments
and required baselines stay pending with zero rows/schema changed.

W02 binds explicitly synthetic test inputs to the genuine original participants.
The coordinator authorized prospective reuse of the existing
`ActualRoleWorkloadArtifact.test-support.ts` fixture values: sorted participant
TOTALs `[0,1,2,3,4,5,6,7,8,9]`; for missing baselines only, fatigue 0.1,
recoveryCapacity 0.5 and policy coefficients 0.01/0.001/0.1, available day 0.
Existing baselines/policies are retained. This is labeled fixture acceptance,
never observed effort, a production calibration, or automatically generated
runtime input. Source packet review is required before execution.

W02 checks all ten exact activity IDs, effort/day/Person bindings, unchanged
physical pitch archives, BEFORE/AFTER conservation, exact assessment/freeze/
charge deltas, insert witnesses, zero-write retry and reopen, and pending guards.
Baseline initialization is also checked against the exact accepted packet and
existing rows. Per-connection total_changes accounting checks 10 assessment
writes, one freeze write, 20 activity/head writes, and zero retry/reopen writes,
including byte-neutral SQL and exec-only writes. Assessment hashes have an
independent oracle from accepted Sources and original participants.
W03 faults real assessment/freeze/activity INSERTs and requires a witness plus
full rollback; activity faults at indexes 0, 1 and 9 preserve only earlier valid
charges and can resume after controlled fault removal/reopen. W04 interleaves a
real peer commit before acquisition. W05 covers changed uncharged heads, genuine
prerequisite corruption, missing/damaged frozen assessments and accepted
reference/effort rejection. W06 rejects competing legacy-pitch claims from each
terminal accept/freeze/charge/read/retry entry point while independently checking
that the original terminal and global workload chains remain authentic. M01–M03 are
synthetic metadata rejection tests for terminal/E/settlement aliases; they make
no claim of a second genuine origin.

Only after reviewed W01 actually fails for the missing capability may production
implementation start. Preserve W01 for GREEN. Run focused typecheck and separately
admitted bounded cases; selected first-base/global/legacy regression tests need
their own runtime controls. The broad suite remains a separate required stage;
do not start it under a focused artifact envelope or claim it passed.
All generated case names use explicit template strings, never Vitest object
interpolation. Verify the exact registered and selected case inventory before
expensive execution; a filtered-out, skipped or differently named case earns no
credit. The retained-copy prerequisite itself is still being qualified.

Unqualified until run: every case here, strict-storage negatives, transaction
replacement/rollback/query-only restoration, all raw-alias combinations and
second-origin coverage. Successful independent scoring interleave before a
workload transaction is also unqualified until the scoring slice provides its
own authentic evidence; W04 proves rejection of a relevant corrupt peer commit
only. A later completed-stage read, reservation-based same-PA
execution and next-play activation require separate contracts and qualification.
