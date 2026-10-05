# Candidate: reuse only the post-trigger PlayEnd proof

Status: the initial counter-only candidate (`68d093b`, based on `5998db4`)
has a reproduced transient-schema limitation. Its 25 passing boundary tests did
not establish that all intermediate database states were unchanged. The new
owned read-only hardening (`cdd43f6`, completed by `cd390c7`) passed all 34
boundary cases after its RED and passed final independent source rereview.
Typecheck, full suite, genuine Native equivalence and wall-time
comparison for this candidate remain unrun. The separate genuine acceptance
gate uses frozen production with all four first-acceptance derivations and does
not validate this candidate.

## Exact duplicated operation

The baseline `SqliteActualFirstBasePlayEndStore.accept` performs a proposal derive, a
before-write derive, a post-trigger current derive, then a historical derive
inside `read(sourceId)` immediately before commit. This candidate would remove
only the fourth derive. The first three must remain. Public historical reads,
references, and both independent immutable-retry reads remain unchanged.

The retained post-trigger evidence is immutable, created by the same private
owner in this operation, never supplied by a caller. A module-private closed-row
reader would continue to fetch and validate the original source row, raw source
identity mirrors, terminal-claim census, all source/snapshot bytes and hashes,
and the exact durable fence. The reused proof's source must equal the freshly
parsed source in that row.

## Current/historical equivalence argument

The `current` argument is consulted at exactly these locations:

- `ActualFirstBasePlayEndEvidenceFromSqlite`: it is passed to the scope owner,
  and it conditionally invokes `actualCommunicationEvidenceFromSqlite.current`
- `ActualLivePlayEvidenceFromSqlite.dependencies`: it adds field/execution
  current-head assertions, an original actor open-frame assertion, and the pitch
  progress-head assertion. It returns the same source/pitch/prefix objects
- The communication current method checks dependencies, re-executed historical
  bytes, and latest communication head, returning no replacement evidence

Both modes otherwise execute the same derivation and construct the same final
immutable evidence. The added current-mode calls are assertions, not alternative
output producers. Therefore successful current-mode derivation entails the
historical output on an unchanged transaction state. This reasoning does not
justify returning current-mode results on a later transaction or altering public
historical reads: legitimate historical evidence can outlive current heads.

The boundary tests compare the full returned evidence (including wholeHistory)
and receipt bytes on the narrow SQLite owner boundary. Their physical proof is
mocked; they are not a Native equivalence proof. The final candidate still needs
typecheck, independent review, and a separately scheduled genuine Native gate.

## Required fail-closed bracket

From immediately before the retained post-trigger derivation through the fresh
closed-row authentication:

1. Require the active writer transaction and establish a private savepoint
2. Preserve the prior query_only setting, enable and verify query_only=ON
3. Record `total_changes()`, `main.schema_version`, and `temp.schema_version`
4. Derive the full current proof and check both the original receipt comparison
   and unchanged transaction/state counters
5. Perform every closed-row/source/hash/fence/terminal validation with that proof
6. Recheck all counters, restore and verify the prior query_only setting, and
   require the savepoint still to exist before commit

The savepoint is necessary because ending and replacing a transaction can leave
both `isTransaction` and `total_changes()` unchanged. Schema counters add
endpoint checks because schema-only changes do not increment `total_changes()`
and temporary objects can shadow unqualified owner tables. They do not prove
that no transient schema changes occurred: a child savepoint rollback can
restore those counters. The owned query_only phase prevents such DDL/DML during
the retained proof and fresh row authentication. Failure attempts writer
rollback; failed cleanup or flag restoration retires the store and preserves
the original validation error plus cleanup errors.

No cache, exported caller-proof method, cross-operation receipt retention,
before-write reduction, trigger-validation reduction, or changes to schema,
workflows, rendering, or build configuration are proposed.

## Priority versus the isolated umpire pair

The umpire pair in `df97872` combines the existing available-call/disposition
reads. Its two production edits are much smaller and apply on every ended or
sufficiently advanced pending derive. It already has 13 mocked passing tests,
but remains unintegrated and untypechecked at the time of this investigation.
This candidate removes a whole historical PlayEnd derivation once per first
acceptance, potentially a larger saving, at a more sensitive transactional seam.

No controlled wall-time or memory comparison has been run for either candidate.
The replay counts establish eliminated work, not a percentage speedup. The
lower-risk next integration candidate is the umpire pair; this guarded end-proof
candidate should follow only if its RED/GREEN tests and independent review hold.
Neither belongs in the currently running frozen Native gate.

## Isolated RED evidence

The 18-case boundary file ran on the unchanged production owner at `5998db4`:
9 tests passed and 9 failed for the intended missing optimization/guards. The
failures observed the fourth historical replay, unnoticed writes during proof
and final authentication, unnoticed main/TEMP DDL, transaction replacement, and
rollback masking the original error. There were no collection/import failures.
The mocked proof cannot certify physical or Native completion.

The guarded runner ended and reaped its process group on 2026-10-05 at
02:20:40 UTC after 3.21 seconds. Sampled aggregate peak RSS was 335,432 KiB
(327.6 MiB), below its 384 MiB cap. Launcher and workers verified Node 26.10.0
and 288 MiB actual V8 heap limits; the 7 GiB available-memory reserve held.
All source hashes were unchanged; no owned process remained. The source
manifest SHA-256 was
`83c6d5c7d11eeefbdf7b29879430d3153c799eba5f4cba5ef3a4c1563bfc3423`.
The RED test is saved in `0d8a0ca`; `2784523` corrects only the test wrapper's
TypeScript forwarding signature for both SQLite parameter overloads.

SQLite's documented behavior supports the guard boundaries:
[`total_changes`](https://www.sqlite.org/c3ref/total_changes.html) counts
completed row changes but not arbitrary other SQL;
[read-only schema version queries](https://www.sqlite.org/pragma.html#pragma_schema_version)
reflect schema changes; and [savepoint lifetime](https://www.sqlite.org/lang_savepoint.html)
is bounded by the surrounding transaction. These checks do not claim to defend
against arbitrary replacement of the private SQLite API itself.


## Initial cleanup review and 25-case light GREEN

Source review identified that swallowing an actual rollback failure could leave
an uncertain writer available for reuse. The repair distinguishes a retired
store from a successfully closed handle. On rollback failure, domain operations
are retired immediately and the handle is closed if possible. An AggregateError
preserves the exact original validation error as cause/first entry, plus the
rollback error and any close error. If close also fails, a later explicit close
can retry; domain operations remain rejected. This is fail-closed cleanup, not
a claim that failed storage cleanup always completed a rollback.

The added rollback-failure test first failed against the initial candidate:
23 of 24 cases passed, and only the intended cleanup assertion failed. After
the repair, 24 of 24 passed. The additional native-close-failure/retry case then
passed with no further production change. The final selection was:

- `ActualFirstBasePlayEndClosedProofReuse.test.ts`: 20 cases
- Existing `ActualFirstBasePlayEndTransaction.test.ts`: 5 cases, including raw
  competing terminal claims, trigger witnesses, and peer-WAL retry invalidation

All 25 passed with zero skips on 2026-10-05 at 02:25:33 UTC. Runtime was
4.50 seconds; sampled aggregate peak RSS was 350,196 KiB (342.0 MiB), below the
384 MiB cap. Node 26.10.0 launcher/forks all recorded a 288 MiB V8 heap limit;
the 7 GiB available-memory reserve held. Sources were unchanged and the entire
owned process group was terminal/reaped. The final source manifest SHA-256 is
`9598e0a4d23f4dde4fbf44278bd68784bc6011896cb500ce90710bd7e3c0d1bd`.

Verified production file SHA-256:
`4695db1fc267f6e3c5b65b0742147ddadb0899a6c0b086579fc6ccb9342bd5df`.
Verified new test file SHA-256:
`6b70045a122fdee1f1afccc97b3cb3b230b2359433ccf7c8e565153b99d6c4ce`.
The test commits are `0d8a0ca`, `2784523`, `c8d5453`, and `2566d30`;
`68d093b` contains only the production candidate. All are local and additive.

No large fixture, actual physical derivation, compiler, full suite, GitHub
publication, merge, workflow, UI or build-configuration change was performed.
The observed 4-to-3 first-acceptance replay count is a mocked-boundary regression
result; no percentage or Native elapsed-time saving is claimed.


## Initial independent source review (superseded by the transient-shadow finding)

The initial bounded delta was independently reviewed on 2026-10-05 after the
cleanup repair. No blocking finding remained: original source/hash/fence/census
checks stay fresh, only the private post-trigger proof is reused inside the
transaction bracket, and historical reads/retries still derive independently.
The separate failed/closed flags keep domain operations retired while retaining
an explicit native-close retry. The error's “store is closed” wording refers to
that retired public interface; native-close failure is retained separately in
the AggregateError. The verified executable bytes were not edited after GREEN.


## Transient-shadow regression and owned read-only hardening

Subsequent source review showed that endpoint counters and an outer savepoint
do not detect CREATE TEMP VIEW followed by ROLLBACK TO a child savepoint. The
new tiny real-SQLite regression reproduces a relevant difference from the
removed historical derive. A real seal INSERT trigger corrupts an upstream
main-table dependency. The third derive temporarily sees a correct shadow view,
then rolls back that view before returning the expected immutable proof. The
counter-only candidate accepts while the independent public historical reader
rejects the now-unshadowed corrupt dependency. The captured endpoint counters
and outer transaction still agree.

This is an injected same-connection SQL seam, not a claim that an ordinary
Source can execute it. The actual writer is private, has no post-Source user
callbacks, and installs no user SQL functions or extensions. Ordinary SQLite
INSERT triggers cannot issue this CREATE/SAVEPOINT sequence. Nevertheless, the
candidate's earlier broad transient-mutation claim was invalid and its clearance
was held pending this hardening.

The minimal repair enables and verifies query_only on the private connection
only after both real INSERTs and their triggers, through post-trigger derivation
and fresh row authentication. The exact prior flag is restored and verified on
success and failure, including an already-ON setting. It leaves any unknown
native authorizer unchanged. Savepoint and endpoint checks remain, with their
narrower meaning. A restoration failure retires domain operations, attempts
rollback and native close, and retains original/restoration/cleanup errors.
Native-close failure still allows a later explicit close retry.

[SQLite query_only](https://www.sqlite.org/pragma.html#pragma_query_only) blocks
DDL/DML while allowing transaction completion. Independently run tiny primitive
probes verified main/TEMP DDL, preprepared DML, trigger writes, prior-ON settings,
and preservation of earlier writes. They also demonstrated deliberate OFF/ON
bypass. This owned phase is explicitly not a security sandbox against arbitrary
SQL that disables the flag, native authorizer replacement, or private API
replacement. Endpoint stamps still must not be described as detecting every
transient mutation.

The 33-case hardening RED ended/reaped at 2026-10-05 02:43:44 UTC: 26 passed and
7 failed for the expected transient shadow, missing read-only phase, and
restoration-failure handling. The historical-read control in the transient
shadow test passed before its intended acceptance-rejection assertion failed.
There were no import or fixture failures. The runner took 6.09 seconds and
sampled 344,616 KiB aggregate peak RSS (336.5 MiB), within the 384 MiB cap;
actual Node 26.10.0 launcher/fork heaps were 288 MiB and the 7 GiB reserve held.
Sources were unchanged and no owned process remained. Source manifest SHA-256:
`12ab3cd54047a579605993c957334a4833646e30ef05685fffac9a6435d43d32`.
The additive RED test commit is `4f9b9da`.

The first 33-case hardening verification ran on 2026-10-05 at 02:52:19 UTC and
reported 32 passes, one failure, zero skips. The failing original transaction
replacement test attempted `BEGIN IMMEDIATE` while query_only was enabled;
SQLite correctly refused that write transaction before the expected savepoint
check. The test was corrected to deferred `BEGIN`, preserving the stronger
assertion that a replaced read transaction can have unchanged counters yet must
lose the private sentinel. Production was unchanged. This first run is not a
GREEN claim: it ended/reaped after 3.64 seconds, peak aggregate RSS 350,576 KiB,
with valid 288 MiB Node 26.10.0 heaps and the 7 GiB reserve. Source manifest:
`31196440e082431a1b7e54f4cf5a3e3d223be2b4060c056bf7abc2746f0cad0a`.


## Read-only hardening final light GREEN

After the test-only deferred-BEGIN correction (`41dcf4a`), the exact 33-case
selection passed at 2026-10-05 02:56:46 UTC: 28 closed-proof boundary cases and
the five original transaction cases, zero failures or skips. The runner ended
and reaped its process group after 4.81 seconds. Sampled aggregate peak RSS was
340,208 KiB (332.2 MiB), below 384 MiB. Actual Node 26.10.0 launcher/fork heaps
were 288 MiB, the 7 GiB memory reserve held, sources were unchanged, and no
owned process remained. Final source manifest SHA-256:
`66aa0d05157fd16b60fe3d37533e17ac214f56b68c1ba1d79776d7c45e161853`.

Production-only hardening commit: `cdd43f6f09d08922942f89f15e1392e725b9d78d`.
Verified production file SHA-256:
`7a2e25d5f31e64a185baa78e8b0f1f3f55bb7552a41ff45e0e8fdba90b2985a3`.
Verified new test file SHA-256:
`f251ca19a056ee2aa4a26833c42e970265d8d8ee65f45940e08cd5c1a544c81c`.

This confirms the small injected-SQL ownership boundary, flag restoration,
transaction-replacement rejection, and fail-closed cleanup. The expensive
physical proof remains mocked. It does not establish actual Native output
equivalence, full-suite compatibility, compiler success, a wall-time saving, or
protection against deliberately disabling the owned read-only flag. No
executable bytes were changed after this final light GREEN.


## Owned read-only setting invariant

Static rereview required the shared unchanged check to verify query_only remains
ON after both the retained derive and fresh closed-row authentication. The new
34-case RED (`e98bfcf`) was 33 passes and one expected failure: changing the flag
OFF during the retained proof, without changing total_changes, went unnoticed.
The test also requires rollback and restoration of the original OFF setting.
Its source manifest SHA-256 was
`380ad627c003f681a55ef1f32d83d2bacb47848b903fb91519a1c9d65f8f12b0`.

The production-only two-line invariant repair is
`cd390c7cbc5679524f16f1c19eb99fe5813e11b8`. Final GREEN ended/reaped on
2026-10-05 at 03:06:12 UTC: all 34 cases passed, zero skips, 3.47 seconds,
344,980 KiB aggregate peak RSS (336.9 MiB). Actual Node 26.10.0 launcher/fork
heaps were 288 MiB; the 7 GiB reserve held and no owned process remained.
Source hashes were unchanged. Final manifest SHA-256:
`3024bf5c2b7e69cd0dbe0ec9dfe8fad7e9671775d91fadd99dfebcd9eb86c184`.

Final verified production file SHA-256:
`c669552e107d24ed57de57d9047dfc2ccaa535324db89be255d53722f1e8a5d1`.
Final verified test file SHA-256:
`15adff1c0636103a3cdaa6e82008f622f9a4df4b2cbdf74c5c766eb8b0b86781`.

This detects an unexpected owned flag change left in effect at either boundary.
It does not turn sampled checks into a sandbox against deliberate OFF/write/ON,
unknown authorizer replacement, or arbitrary private API replacement. No
executable changes followed this final GREEN; the earlier 25- and 33-case
passes and every intermediate RED/failed-verification receipt remain separate.


Final independent source rereview cleared `cdd43f6` plus `cd390c7` on
2026-10-05 under the explicit owned-setting contract. No blocking finding
remained in this bounded delta: the read-only phase prevents the transient
shadow, both checkpoints verify the flag, transaction identity checks remain,
and failed restoration/cleanup retires domain access while preserving error
objects and an explicit native-close retry. This is source-review clearance
plus mock-boundary evidence only; integrated typecheck, Native equivalence and
performance claims remain pending their separate gate.
