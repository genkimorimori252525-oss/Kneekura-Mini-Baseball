# Physical producer admission checkpoint

Verified admission-module Source: `dc02038864eac0941e890fe222cf426b0dc0c3f1`. This documentation update follows that verified code. The scope is the standalone actual pipeline's successful-producer input boundary. It changes no UI, workflow, package, game rule or domain owner.

## Observed verification

The two pure Node test files are `physical-producer-evidence.test.mjs` and `physical-producer-files.test.mjs` under `tools/verification/actual-live-pipeline`. They use synthetic JSON, injected byte/WAL metadata reads and relocated explicit paths. They import no artifact helper, open no SQLite database and do not create or authenticate a real physical end.

| Phase | RED Source and observed result | GREEN Source and observed result |
|---|---|---|
| Semantic admission | `1d7201e`: 4 passed, 48 failed | `4966331`: 52 passed |
| Pinned file loader | `4c2609b`: 52 passed, 10 failed | `25a3e35`: 62 passed |
| Raw JSON sidecars | `39fc417`: 64 passed, 18 failed | `dc02038`: 82 passed |

The final GREEN run completed on 2026-10-05 at 02:55 UTC with **82 tests / 82 passes / zero failures, skips, cancelled or todo tests**. The launcher observed actual Node 26.10.0 in the parent and both test processes, each with 192 MiB requested old space and 288 MiB total V8 heap. It enforced a 30-second wall limit, 384 MiB aggregate process-group RSS limit and 7 GiB available-memory reserve.

Measured runtime was 0.3868 seconds; sampled aggregate peak RSS was 146,292 KiB (142.86 MiB). Exit was zero, no guard fired, all owned processes were reaped and no owned process remained. Before/after source-manifest SHA-256 was unchanged at `787d412e6f6779b78878124c10f6f0143c60676fdb2ea3916127302b1a4fdcdc`.

## Review and enforced boundary

Independent review identified a raw-evidence gap in the first loader implementation: a successful-looking publication projection could replace the admission, results or artifact-audit JSON while still satisfying matching hashes. The eighteen new rejection cases reproduced that finding before the fix. Follow-up static review cleared the bounded fix that checks all four raw JSON roles before artifact byte access.

The terminal, admission, results and artifact audit reject top-level `kind`, `schema`, `publicationProjection` and `originalRawReceiptSha256`. The published original-input manifest and the three explicitly pinned negative-phase proofs remain allowed in their separate supporting roles. Nested Vitest metadata is allowed. A previous interrupted negative run remains negative evidence; it cannot become a clean-success receipt.

All seventeen input files require explicit, distinct absolute path/SHA-256 bindings: terminal and closed output; admission, results, artifact audit and original-input manifest; before/after producer Source manifests; runtime binary and original input; four launcher controls; three negative-phase proofs. The raw successful terminal is checked first. JSON is hashed and decoded from the same bytes. The adapter checks the other raw JSON roles before hashing any SQLite artifact, then supplies the complete independently observed bundle to the pure semantic validator. Later stages and terminal supervision recheck every bound input.

Success additionally requires the exact producer Source/runtime/control/lineage bindings, both named producer assertions, zero pending/failed tests, actual worker heap receipts, clean process reap, the matching audited physical end and seal, preserved original tables and absent/empty input/output WAL. This does not replace the official helper's normal same-connection owner authentication.

## Remaining execution boundary

No actual producer load/semantic admission, official application, ten-player role settlement or next-pitch artifact run is claimed by this checkpoint. The earlier helper typecheck, 24 helper/control tests and syntax/import-only checks belong to their recorded Source cuts; they are not reclassified as validation of these later changes.

Before an actual run, the coordinator must integrate the reviewed modules onto the final optimized and verified Source, freeze that exact Source and bind its manifest, select explicit process budgets and admit the genuine raw successful producer bundle. A byte/WAL-metadata admission probe alone proves neither downstream owner execution nor acceptable full-pipeline runtime. Watcher backups and sanitized publication summaries remain ineligible as producer-success inputs.

The actual stages still require seven witnessed real target INSERT faults, explicit workload efforts and accepted baseline/rate Sources, original-lineage preservation and closed/reopened/retried per-stage artifacts. No completion is inferred from a cold closed-end read, isolated timing improvement or pure admission fixture.

## Bounded official-stage verification

The later source `444b6187364dbfed4d42f3b5debd26ee833699d0` integrates the
reviewed producer contract with the scoped physical replay owners from PR #300.
It adds an explicit official-only mode, distinct control-only supervisor smoke,
and a hashed closed-output handoff. The full official helper still performs both
real INSERT rollback probes, queued close/reopen, application, retry and final
close/reopen. The three pure read groups now own a real read transaction and
restore `query_only`; domain writers and revalidation remain unchanged.

TDD first reproduced the scope gaps (20 Node cases: 6 passed, 14 failed) and the
read-transaction gaps (14 cases: 4 passed, 10 failed). The focused fixes passed
20 Node and 9 Python scope cases, and 14 transaction cases. Independent static
review found no remaining blocking issue in these deltas.

The first integrated compiler attempt failed because the isolated checkout
lacked its generated club catalog. That attempt is retained as a failed setup
check. Running the existing catalog generator added only the expected generated
file; no tracked source changed. A fresh source manifest includes all **2,103**
tracked/generated files, SHA-256
`a27e27c281b0dabda8ffe25c52c19121061fe63721dc251891ca70d8db216f3d`.

The corrected exact-source preflight passed the complete compiler, **102** pure
Node producer/scope tests, **9** Python scope tests, **38** helper/adjacent tests,
and wrapper syntax checks. Compiler duration was 24.78 seconds with verified
1,504 MiB total heap and 1,306.5 MiB peak aggregate RSS. Helper tests took 5.64
seconds and peaked at 357.66 MiB. All source hashes stayed unchanged and every
owned process was reaped. Final preflight terminal SHA-256:
`a77fbe55cdd5a7802a31c67ad9d373f1ad6e2b754f13f5a81ab792e6bf1cdefa`.

The actual positive supervisor smoke then passed on the same frozen source. It
rechecked all 17 producer files, verified actual Node 26.10.0 / 288 MiB heap,
retained both Native locks and rejected competing acquisitions. Supervisor
execution took 3.463 seconds and peaked at 133.62 MiB aggregate RSS; outer
supervision exited zero with no surviving process. No domain helper was imported
or executed, and no SQLite artifact was opened. Outer receipt SHA-256:
`d757fb017aa6366d14b12481742f5bc2e07303ada413b8ce0736f99fc33ceb76`.

The genuine official-stage attempt began at **2026-10-05 04:47:58 UTC** with a
7,200-second wall cap, 1,536 MiB aggregate RSS cap, verified 1,120 MiB total heap,
and 7 GiB launch reserve. Its status at this publication checkpoint is
**running, not passed**. No workload or next-pitch helper has run in that attempt.
A downstream handoff consumer is separate work; this change preserves the output
contract without claiming that continuation already exists. A complete pipeline
or cumulative whole-project pass is not claimed.

## First official-attempt terminal

The running attempt above subsequently failed at **2026-10-05 04:51:18 UTC**
before any official application. The original physical fixture's Match references
`test-rules`, which the normal rule-profile owner rejects as unsupported during
the missing-policy check. The official helper started once and completed zero
times; downstream helper counts and preserved stage receipts are zero.

The supervisor exited 1 after 201.65 seconds, without a wall/RSS guard event.
Peak aggregate RSS was 392,456 KiB; source, producer/input and receipt audits
passed, all SQLite handles closed, and the outer owner reaped every process.
This is a real fixture/profile validation failure, not official success or a
resource interruption. The original physical input and its successful physical
proof remain unchanged. Fixing the fixture's explicit rule-policy provenance
requires separate verification; no profile alias, database rewrite or inferred
rule semantics is authorized by this failed attempt.
