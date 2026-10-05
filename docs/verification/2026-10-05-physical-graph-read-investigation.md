# Physical execution graph read investigation

Source baseline: `f3c77838a63aa8d2a3dd2e490cd52c0458666be1`.
Status: isolated implementation with bounded primitive and tiny RED/GREEN tests.
No compiler, full suite, Native run, publication or measured speedup claim.

## Exact repeated graph

The named physical owner is `SqliteBattedWorldFieldExecutionStore.ts`, exporting
`battedWorldFieldExecutionEvidenceFromSqlite`; there is no separate
`BattedWorldFieldExecutionEvidenceFromSqlite.ts`.

1. `actualFirstBaseClosedEvidenceFromSqlite.read` invokes
   `readClosedEvidence` → `actualFirstBasePlayEndEvidenceFromSqlite.derive` before
   comparing the saved end receipt and seal (`SqliteActualFirstBasePlayEndStore.ts`,
   lines 33–66).
2. PlayEnd derive gets its first physical prefix through
   `actualLivePlayEvidenceFromSqlite.deriveWithPhysicalPrefix` (PlayEnd lines
   44–48). LivePlay `dependencies` reads the field root, its field prefix, and
   `executions.scope(baseField, executionSourceId)` (LivePlay lines 40–57).
3. Execution `scopeWithReplay` reads the complete raw ownership census and heads,
   including cross-row raw JSON aliases and future metadata. It authenticates
   each payload through the requested bound by `executeWithReplay` and compares
   original archive bytes/hashes (execution lines 352–443).
4. For every owned scheduled action, `executeWithReplay` preflights the strictly
   earlier physical rank, then reads each motor and decision (lines 153–175).
   These converge again on earlier physical prefixes:
   - motor `derive` → decision `read`, defensive context `read`, sometimes origin
     decision/context, and player-kinematics `read`
     (`SqliteActualLocomotionStore.ts:38–53`)
   - decision `scope` → each original decision `execute` → defensive context,
     plan `read`, model `read` (`SqliteActualDefensiveDecisionStore.ts:49–66,
     166–179`)
   - plan `derive` → defensive context (`SqliteActualDefensivePlanStore.ts:39–41`)
   - defensive context → observation `read`, then field `read` again
     (`ActualDefensiveContext.ts:35–62`)
   - observation `dependencies` → field `read`, field `scope`, execution `scope`
     (`SqliteActualFieldObservationStore.ts:47–63`)
   - player-kinematics `read` → field `read`, field `scope`, execution `scope`
     (`SqliteActualPlayerKinematicsReader.ts:35–52`)
5. Each field `read` itself replays response → first fielder touch → world
   contact → ball flight → physical-pitch history, as well as original geometry
   and model ownership (`SqliteBattedWorldFieldStore.ts:111,175–180`,
   `SqliteBattedContactResponseStore.ts:78–79`,
   `SqliteBattedFirstFielderTouchStore.ts:29–30`,
   `SqliteBattedWorldContactStore.ts:93–94`,
   `SqliteBattedBallFlightStore.ts:65–87`).
6. After the initial full physical prefix, PlayEnd's sibling branches replay
   those same nodes again:
   - all original observation rows (PlayEnd line 100)
   - decision live-work and latest decision checks (lines 108–115)
   - rule-consumption reader (line 132) → capture execution `read`, rule execution
     `read`, queue derive → LivePlay prefix
     (`ActualLiveRuleConsumptionFromSqlite.ts:29–40`)
   - umpire available-call/disposition, every admitted call, and importReferences
     (PlayEnd lines 138,177,182) → umpire setup/observation/rule/current execution
     reads (`SqliteActualFirstBaseUmpireStore.ts:78–109,175–195`)
   - queue-consumers derive (PlayEnd line 144) → queue derive and rule-consumption
     receipts (`ActualLivePlayQueueConsumersFromSqlite.ts:13–27,58`)
   - communication read/current (PlayEnd lines 152–154) → call, current execution
     pair and field prefix (`SqliteActualCommunicationStore.ts:90–109,148–161`)

This is a converging DAG, not a necessary physical replay tree. Existing
`dependencyPrefixes` prevents recursive replay of already authenticated earlier
execution nodes while one owned action is being derived. It is installed only
around that action's dependency reads and restored in `finally` (execution lines
130–134,164–178). At line 410, scope still rechecks the raw census, rank and exact
source/snapshot encodings before returning the earlier prefix. Sibling PlayEnd
branches run after this context has been removed. Reusing prepared metadata
statements and immutable archive encodings does not retain physical results.

## Smallest useful candidate boundary

The candidate should be a single root-owned **physical traversal**, established
for one synchronous PlayEnd derive. It must not cache PlayEnd, observation,
decision, communication or rule-owner results. A complete verified field root
and execution prefix are installed only by those owners after all source,
dependency and archive checks succeed. Sibling requests can then select the
same or earlier authenticated prefix. The existing recursive decreasing-rank
ceiling takes precedence while an action is in progress; the later completed
root prefix must never let that action see its own or future evidence.

Keys must include connection identity, full authenticated source/version and
original field bytes, explicit bound semantics (`null`, absent and a Source ID
are distinct), and validation/read mode. A partially supplied or mutated field
must not match by source ID alone. No null/missing/error result is retained.
Retained node values must be immutable. Fresh caller-owned field-prefix arrays
are not retained or accepted as proof seeds; reused execution-prefix arrays are
frozen. Clear every entry in `finally`,
including nested/reentrant failure. Each new derive, independent store call,
immutable retry, before-write phase and after-trigger phase starts from nothing.

Keep current-head assertions at their original call sites. Keep raw ownership
alias/future-metadata checks, exact original archive identity and source parsing
fresh on a reused execution prefix, following the existing `dependencyPrefixes`
path. Do not expose an API that accepts a caller's proof/prefix. This removes
physical derivations but does not by itself make every SQL scan linear; residual
metadata cost must be measured rather than called solved.

## Why the existing adjacent guard cannot simply be broadened

The post-trigger proof optimization has a short, owned writer interval and a
single retained immutable proof. Its savepoint detects transaction replacement;
its change counter detects completed row writes including trigger writes; its
schema counters detect endpoint schema differences. It does **not** establish a
monotonic epoch for every SQL mutation during an arbitrarily longer graph read.

For example, an inner `SAVEPOINT`, main/TEMP DDL, and `ROLLBACK TO` that inner
savepoint can restore the schema counter while keeping the outer sentinel and
row-change counter unchanged. Evidence read while a temporary view shadows an
unqualified owner table could survive in a broader memo after that view is
rolled back. The same issue applies to trying to treat `isTransaction` as a
transaction identity. A surviving outer savepoint only proves its own survival;
it does not mean no nested rollback happened.

The current public evidence type exposes only `prepare`. It has no transaction
epoch or mutation callback. Node's `setAuthorizer` can reject DML/DDL/transaction
control, but there is one authorizer per connection and no API to retrieve and
restore an unknown caller's authorizer. It also authorizes compilation, not an
unrestricted execution counter. Installing it blindly on caller-owned handles
is not an acceptable generic solution.

A narrowly owned read-only bracket is being evaluated: temporarily enabling
SQLite `query_only` during the synchronous traversal would prevent DML/main/TEMP
DDL rather than hoping to observe every transient state; preserve and restore
the previous setting, retain a private savepoint and endpoint guards, and do not
share evidence outside that bracket. This needs real-SQLite boundary probes,
including preprepared statements, main/TEMP changes, rollback/rebegin, nested
DDL rollback, triggers and exception cleanup, before it can be called safe.
It is not protection against arbitrary replacement of the private SQLite API,
and must not silently override an existing authorizer or general SQL settings.

## References

- [SQLite total_changes](https://www.sqlite.org/c3ref/total_changes.html): row
  changes and trigger changes, not arbitrary SQL
- [SQLite savepoints](https://www.sqlite.org/lang_savepoint.html): inner rollback
  restores state without necessarily ending the outer transaction/savepoint
- [SQLite schema_version](https://www.sqlite.org/pragma.html#pragma_schema_version):
  reflects schema state, not a monotonic mutation log
- [SQLite query_only](https://www.sqlite.org/pragma.html#pragma_query_only): prevents
  data changes but still permits transaction commit
- [Node SQLite authorizer](https://nodejs.org/api/sqlite.html#databasesetauthorizercallback)
- [SQLite authorizer](https://www.sqlite.org/c3ref/set_authorizer.html): one callback
  and compilation-time authorization

## Bounded primitive evidence

The 17 standalone real-SQLite primitive probes all passed on 2026-10-05 at
02:38:18 UTC. Node 26.10.0's actual V8 heap limit was 288 MiB; execution took
0.125 seconds with sampled aggregate peak RSS 61,224 KiB, below the 384 MiB
cap. The 7 GiB available-memory reserve held. The process group was terminal,
reaped and empty, and the shared light lease was released. No application module,
fixture, physics or compiler was loaded.

Verified outcomes:

- Rolled-back main and TEMP schema shadowing both escaped all endpoint stamps
  and left the outer savepoint intact
- `query_only=ON` rejected all tested DML, main/TEMP DDL and trigger mutations,
  including statements prepared before the setting was enabled
- A post-write transaction kept its existing values while read-only, and could
  legitimately write again once its original OFF setting was restored
- Nested prior ON settings stayed ON; rollback/rebegin kept query_only but
  destroyed the private savepoint
- Deliberately switching query_only OFF, creating/reading/rolling back a TEMP
  shadow, then switching ON bypassed the setting and endpoint stamps. This is
  an explicit contract limit: the production operation owns that setting; it is
  not a security sandbox against arbitrary privileged SQL on its private handle
- Replacing the single authorizer demonstrably removed an existing policy, so
  the candidate must never install/clear an unknown caller's authorizer

Probe source SHA-256:
`17b26f619171fd3d1219ba3cf7e55e6ffb8758023a304d380cb0d87170f0b695`.
Node runtime SHA-256:
`ab9c8eecf9f82d6693cdc3accced17034065c8d96213b0aa76a7e803d20ae1da`.

`ActualFirstBasePhysicalReadTraversal.test.ts` now contains 17 unrun candidate
boundary cases using real field/execution owner reads and a tiny real SQLite
archive, with expensive lower physics mocked. Their intended REDs are duplicate
field/execution derivation and missing operation-wide mutation/read-only guards.
They also cover independent operations, no-transaction fallback, preprepared
TEMP DDL, nested restoration, unchanged authorizer policy, peer-WAL snapshot
release, current-head checks and partial/changed caller-field rejection. They
have not yet been executed or used as evidence of production correctness.

## First production-boundary RED run

The unmodified production owner collected all 17 tiny cases: 8 passed, 8 failed
for the intended missing optimization/guards, and one control had an incorrect
expected count. The latter expected four execution derives without a transaction;
the existing fallback intentionally performs a third physical-prefix read, so
the actual count is six. Only that expected control count was corrected after
the run; the corrected file still awaits its separately bounded RED rerun.

The intended failures observed eight field derives and four execution derives
for a two-node graph that should need one field derive and two execution derives;
independent/nested operation duplication; accepted main/TEMP DDL; accepted
rollback/rebegin; accepted rolled-back TEMP shadowing; and accepted preprepared
TEMP DDL. Existing same-connection DML rejection, settings/policy preservation,
peer-WAL release, current-head rejection and partial/version-changed caller-field
rejection supplied passing controls. There were no import/collection failures.

Terminal/reaped: 2026-10-05 02:40:14 UTC. Runtime 4.25 seconds; aggregate sampled
peak RSS 352,628 KiB (344.4 MiB). Launcher and worker each recorded Node 26.10.0
and a 288 MiB actual V8 heap limit. The 7 GiB reserve held, sources were unchanged,
and the owned process group was empty before releasing the light lease.
Source manifest SHA-256:
`728f5a7d71dcc10cdddc9cd65b62237ee6c4523b75f198eb8fbe48b9ed954869`.
No production implementation or Native performance claim follows from this RED.

## Candidate shape after primitive checks

The narrow implementation can stay in the two existing physical owner modules
plus the PlayEnd entry point:

1. The field owner privately owns its traversal state. A narrowly named internal
   wrapper establishes an active-transaction-only, synchronous read-only bracket,
   records/restores prior query_only, installs a unique private savepoint and
   checks endpoint stamps before returning. It does not touch an authorizer.
   Missing transaction/exec capability retains the original fresh-read path.
2. The execution owner wraps one PlayEnd derive, calls that field-owned bracket,
   and installs its own private execution-prefix map only for the callback's
   lifetime. Nested derives get fresh maps and restore their parents in `finally`.
   No setter or API accepting caller-supplied evidence is exported. The wrappers
   only start/finish internally owned operations; actual owner authentication is
   the sole place that can publish entries.
3. The field map is seeded only by a completed own `read`, never an arbitrary
   caller-supplied `scope` input. Exact authenticated response/geometry and field
   snapshot bytes must match before a scope borrows those immutable results.
   Existing row census, source parsing, head and archive checks remain fresh.
4. The execution map stores only completed authentic nodes after source and
   archive validation. Each scope still validates the raw entire ownership
   census/heads/future aliases and each selected source/archive. The recursive
   `dependencyPrefixes` ceiling runs before any sibling reuse lookup, preserving
   the strict earlier-rank restriction even after a later root node is available.
5. `derive`, `currentBefore`, `current`, `currentAdmission`, and public readers keep
   their existing checks. No node may survive a root operation, store retry,
   before-write/after-trigger phase, replaced transaction or connection boundary.
6. Failure to restore query_only or release the sentinel prevents returning any
   evidence and clears every private entry. Preserve the original error together
   with cleanup failures. The caller's private store owns retirement/close policy;
   the evidence wrapper must not quietly close an unknown caller-owned handle.

This targets physical simulation/root replay only. It deliberately leaves fresh
raw metadata authentication in place; it is not yet a claim that SQL preparation
or the complete multi-owner proof graph is linear. The existing 34/26 upper-level
closed-end reads remain independent and must never share this traversal.


## Corrected production-boundary RED

The correction attempt changed the nontransactional control from four to six,
and all 17 cases collected: nine controls passed and eight assertions failed.
Independent review subsequently found that the same edit accidentally changed
the nested-operation expectation from four to six as well. Thus seven failures
were valid targeted REDs and the nested assertion needed restoration to its
original four. That original nested assertion had already failed correctly
(eight observed versus four expected) in the first RED. No production bytes
changed between the two RED runs. The final nested assertion was restored before
GREEN; the two RED runs must not be described as one error-free full RED pass.
Terminal/reaped: 2026-10-05 02:45:33 UTC; runtime 3.71 seconds; sampled aggregate
peak RSS 351,972 KiB (343.7 MiB). Launcher/workers verified Node 26.10.0 and
288 MiB actual heaps, the 7 GiB reserve held, no process remained, sources were
unchanged, and the shared light lease was released.
Manifest SHA-256:
`21ac281b37526a1d3d679a7da84f4c96f5fb5926a8afb8a922c5ee15d2cabd7a`.

## Isolated implementation candidate

After the corrected RED, the candidate was implemented in the field owner,
execution owner and PlayEnd entry point. Its physical maps remain private, and
only successful own field reads authenticate eligible identities. Reused
execution nodes still pass the existing whole-owner metadata/alias/head scan,
full selected Source parse/hash comparison and exact archive-byte/hash check.
The older dependency-prefix rank ceiling runs before the new sibling reuse path.

The root bracket requires a real `DatabaseSync` with an active transaction; other
calls take the original fresh path. It uses a unique savepoint, preserves the
existing query_only setting, and never installs or clears an authorizer. Every
reuse checks query_only and row/schema stamps, and returning root evidence also
requires the original savepoint to survive. Errors and cleanup errors are
reported together; private maps are removed/restored in `finally`. It never
closes an unknown caller-owned connection. Current/head/admission methods remain
at their original call sites and still perform their current-only assertions.

Two older tests that wholly replace physical ownership gained the corresponding
wrapper mock; they still test their original pairing/umpire wiring. The new
real-field/execution-owner test is responsible for actual traversal guards.
The candidate has now run the tiny GREEN below. Typecheck, full suite and Native
equivalence remain unrun.


## Tiny GREEN and source review

The exact 32-case selection passed with zero failures/skips on 2026-10-05 at
03:00:08 UTC:

- `ActualFirstBasePhysicalReadTraversal.test.ts`: 17
- `ActualFirstBasePlayEndPrefixReuse.test.ts`: 6
- `ActualFirstBasePlayEndUmpireReuse.test.ts`: 6
- `BattedWorldFieldExecutionReadPair.test.ts`: 3

On the tiny two-node graph, the operation now performs one field derivation and
two execution derivations; independent and nested operations each get their own
fresh traversal. These counts establish eliminated work at the mocked-physics
ownership boundary, not a Native elapsed-time saving. All real SQLite source,
metadata, archive, transaction and policy checks in this selection passed.

Runtime was 5.89 seconds; sampled aggregate peak RSS was 347,800 KiB (339.6 MiB).
The launcher and all four workers recorded Node 26.10.0 and 288 MiB actual V8
heaps. The 7 GiB available-memory reserve held, no guard tripped, sources were
unchanged, and the process group was terminal/reaped/empty before lease release.
Manifest SHA-256:
`3bfe0f80d618f170866516a77575572da3f8b2ecc6ca6c982721b88d744215a6`.

Verified executable source SHA-256 values:

- Field owner: `8ba9357176ab8ea5f1c40b3a6f1c194a5ef581e4ae1b7bafe3f39406c4d4a2f2`
- Execution owner: `1c1679225de757d03fdf1d4b1b8f7b5561a2a3b28fd3e23e3ee10407f06b3de0`
- PlayEnd entry: `8ff0558f518b64cb762b762ea0d548bd3d55422b8dd6b32d69b8f45ca7e6e0aa`
- New test: `aa4188f59753b5f1b34f3566e9176dc372b6b2adf7ac7eb1447e3f08bcfb83de`

The coordinator's independent source review found no blocker before GREEN,
conditional on testing, typecheck and a genuine artifact rederivation. A second
source-only reviewer caught the nested test correction described above.
There has been no compiler, full-suite, large-fixture or actual physical graph
execution for this candidate, and no publication, merge or frozen-source edit.


## Final independent source verdict

A second source-only reviewer found no blocking production defect in `7939e4f`
under the documented owner-controlled bracket contract. The reviewer confirmed
fresh selected Source/version/archive checks, exact authenticated field identity,
recursive dependency-rank guards before sibling hits, independent operations,
nested-state restoration and untouched authorizers. The reviewer ran no tests,
compiler or physics and did not certify Native equivalence/performance.

Nonblocking follow-up coverage remains: tiny earlier/later/null/omitted-bound
reuse, a caught inner traversal failure, and a warmed cache beneath the existing
physical dependency-rank gate. Field scope returns a fresh caller-owned array;
that array is neither retained nor accepted as a seed, so its mutability cannot
poison cached nodes. This document's earlier blanket immutable-array wording was
narrowed to match that implementation. No executable bytes changed after GREEN.
