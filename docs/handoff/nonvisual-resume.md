# Resume the retained LAN import checkpoint

As of 2026-10-14, the resumable boundary is the **accepted live-appeal import**,
before rights admission. The exact cp1 entry has source review and finite
qualification (23 cases). Its later Native historical authentication was
interrupted; completion, cleanup, remaining-suffix PASS and whole-case PASS
are **not established**. This handoff preparation ran no Native case, benchmark,
new game generation or CI.

This is an input-dependent continuation. The repository contains the code,
assertions, byte identities and portable adapters. **The owner must separately
provide the exact audited compressed SQLite file below.** GitHub alone cannot
recreate the accepted history, and generating a fresh fixture does not resume it.

## Public source and input identity

Use the checkout containing this handoff and its `tools/handoff` adapters. Its
source/dependency inputs must match [PR #374](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/374),
commit [`731458d6c1ce9eb56220fb16746bb46efd1a4cd9`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/731458d6c1ce9eb56220fb16746bb46efd1a4cd9)
(src tree `b8e99a25cb5aa9afce821f27071687d13893c225`). The preparation tool pins
that complete src tree plus the dependency/config/catalog Git objects and
checks their working files. Documentation/tools-only descendants are allowed;
changed production source requires a new review and qualification.

```sh
git clone --branch codex/current-nonvisual-owner-integration-2026-10-08 https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball.git
cd Kneekura-Mini-Baseball
git rev-parse HEAD
git rev-parse HEAD:src
```

Record the resolved handoff commit. If the branch has moved and its src tree no
longer matches, stop and select the published handoff commit containing these
adapters. Do not weaken the tree check to follow the moving branch.

| Owner-supplied artifact | Exact identity |
| --- | --- |
| gzip length | 1,402,518 bytes |
| gzip SHA-256 | `18605d0643eb51e69c9e290fef93c436a77275c16b172d059ce869dcd83fcd50` |
| decompressed SQLite length | 22,654,976 bytes |
| decompressed SHA-256 | `60b73b1f5f5289cb9c86f128f129bde0d5ea7d8bda4be9805566589198082ee3` |
| structural audit | 121 tables; 1,985 rows; integrity `ok`; no foreign-key violations |

Use the original gzip bytes. A newly recompressed file is not interchangeable,
even if its raw database happens to match. Keep both supplied gzip and any
supplied raw DB immutable and outside the repository. Never open the supplied
raw DB through a Native owner. Only separately materialized copies may be used.

The saved boundary has:

- Review session `lan01:journal:session`, revision **1**, one event
  `lan01:journal:import`, ledger revision **4**, import rights **pending**.
- Review head hash
  `9da947d628e0f4bffd6d4b6c1ea2a5c6ae7405f37c577f98f2b7de10615c2f2a` and
  projection hash
  `e9f260dd6d7688dac9483142855a9af0747c452a40d11d470b3d039fa3751d18`.
- The original appeal, seal, sealed CatchWork and complete cut24 are retained.
  The Match is still revision **1**, play **8**, with **0 outs**.
- No accepted rights, explicit official appeal judgment, LAN terminal outcome,
  LAN scoring application or LAN closure. One earlier walk application and
  scoring row already exist; those historical rows must remain unchanged.

The authoritative pin and ancestry chain are
[`LAN01_RETAINED_REVIEW_IMPORT_CHECKPOINT`](../../src/host/world/LAN01RetainedCheckpoint.test-support.ts).
Its source provenance identifies the earlier generating source. That identity
is separate from the newer source used to resume it. Do not rewrite either one.

## Install the pinned tools

Run from the repository root in an isolated checkout on the chosen execution
machine. Do not dispatch a workflow or start the home-PC runner for this handoff.
Use **Node 26.10.0**: the repository's verification contracts pin that version;
workflow declarations of Node major 26 alone are less precise. The SQLite engine
is Node's built-in `node:sqlite`, not `better-sqlite3` or a replacement binding.

`package-lock.json` resolves TypeScript **5.6.3**, Vitest **2.1.9**,
`@types/node` **26.6.1**, Vite **5.4.21**, Rollup **4.63.3** and esbuild
**0.21.5**. Keep the complete lockfile. The repository does not pin an exact npm
version; record the npm version actually used instead of inventing one.

```sh
node --version
npm --version
npm ci
node tools/catalog/compile-catalog.mjs
node tools/catalog/compile-catalog.mjs --check
```

The catalog compiler regenerates the ignored
`src/core/world/catalog/GeneratedClubCatalog.ts` from versioned source blobs.
It creates no game or checkpoint. `npm run typecheck` and `npm test` have
pre-hooks that run this compiler; the direct Vitest command below does not.
Do not substitute `npm install`, upgrade dependencies, or run the repository's
unfiltered `npm test`/`npm run verify` to resume this one boundary.

## Prepare an independent copy

Make a private directory beside, rather than inside, the checkout. For example,
from the repository root:

```sh
mkdir -p ../baseball-resume-input/owner-input
cp tools/handoff/lan01-cp1-input.example.json ../baseball-resume-input/input.json
```

Place the owner-supplied gzip at
`../baseball-resume-input/owner-input/lan01-import-accepted.sqlite.gz`. The example
descriptor retains the original loader's `nativeReleased` field and uses
relative paths, resolved against the descriptor's directory. The run directory's parent must exist, its path must be canonical,
and the run directory itself must not exist. Symlink input paths are rejected.

```sh
node tools/handoff/prepare-lan01-cp1.mjs ../baseball-resume-input/input.json
```

Preparation checks source/dependency versions and the compiled catalog, then
gzip size/hash, bounded decompression, raw size/hash, and a separately written
read-only inspection copy. On that copy it checks SQLite integrity, foreign
keys, table/row counts, review revision/event/head, ledger revision, pending
rights and unchanged Match/terminal extent. It then rechecks both file hashes.
It does not load Native owners, authenticate the historical ancestry, or run
the suffix.

The new run directory contains `preflight.sqlite`, `preflight.json`, `tmp/` and
`retained-input.json`. The latter uses exactly the existing loader's three
fields: `nativeReleased`, `checkpointGzip`, `destinationDirectory`. The example
sets the existing `nativeReleased` field to false, so accidental Native
invocation is rejected; preparation preserves the supplied boolean. The
`suffix/` destination is left absent for the original loader's exclusive
materialization.

A failed preparation leaves its evidence in place. Diagnose the failure and
use a new run-directory name; do not overwrite it or relax a pin. A missing
artifact, wrong hash or newer revision is a stop, not permission to reconstruct
the checkpoint from a different run.

## Release and invoke the original suffix

This is a future execution procedure, **not a request to start it while
preparing or reading this handoff**. Before release, review the chosen source,
dependency tree, input, destination and process/resource controls. Establish
that no previous process is still using an output copy. An interrupted run
with unknown cleanup is not a clean terminal result.

The portable adapter is new handoff glue and has only static validation. It
does not carry over an old release, witness bundle or resource-supervision
qualification. A reviewed execution supervisor must own the whole process
group, record actual worker runtime/heap, monitor aggregate memory and wall
time, stop/reap all children on a guard event, and record terminal cleanup.
The existing boundary's envelope was: one fork, 1,024 MiB requested V8 old
space, 2,048 MiB aggregate RSS ceiling, 4,096 MiB free-memory reserve, at least
6,144 MiB available at admission, 43,200-second wall ceiling, and
42,900-second case timeout. Raising a ceiling is a new execution decision.
The checked-in adapter alone does not enforce RSS, reserve or process cleanup.

The public
[`supervise-pipeline.py`](../../tools/verification/actual-live-pipeline/supervise-pipeline.py)
cannot be invoked unchanged for this case: it accepts specific artifact-stage
schemas, validates their inherited producer receipts, requires environment-bound
lock identities, and launches its own stage entry. It has no LAN cp1 execution
scope. The earlier LAN observer/supervisor is also bound to its separate
execution packet; copying its configuration would introduce unavailable
receipts and machine paths. Neither is a qualified portable LAN supervisor.

The bounded implementation still to be supplied must follow this algorithm:

1. Acquire exclusive ownership of one Native lane. Pin the complete source and
   generated-file census, installed dependency files, Node binary, adapter and
   control files, descriptor and input gzip. Record and compare the full
   before/after inventory. Admit only at 6,144 MiB available memory or higher.
2. Start the exact command below in a new owned process session, with one Vitest
   fork. Monitor the complete descendant family, including backup children,
   every 200 ms; durably record resource samples at least every 5 seconds.
   Bind process identities to start identity as well as PID; never signal a
   recycled PID. Treat an unreadable process census as a failed guard. Stop
   for 43,200 seconds elapsed, aggregate RSS above 2,048 MiB or available memory
   below 4,096 MiB. Record actual worker Node version and heap, not just flags.
3. On a guard or supervisor exception, signal the owned family with TERM, wait
   at most 2 seconds, then KILL and reap. Account for descendants that changed
   process group and adopted orphans. Recheck all identities after parent exit;
   remaining or unreadable processes mean cleanup is unconfirmed. Never
   authorize a concurrent retry based only on the parent process disappearing.
4. Preserve a returned-owner operation journal if incremental checkpoints are
   needed. Observe the real receiver without replacing arguments, returns,
   exceptions, accepted Sources or assertions. A commit is observed only after
   its synchronous owner call returns. Durably record that return before
   attempting a backup. A thrown call is not an accepted checkpoint.
5. For each returned committed change, synchronously back up the owned output
   DB through SQLite's read-only backup API so committed WAL is included; do
   not copy its live main file alone. Use new exclusive filenames. Within a
   read transaction compare complete schema and table rows, retaining original
   rowids, exact float/blob encodings, user version and application ID, before
   and after backup. Require the backup census to match and integrity to be
   `ok`. Bound the backup child to 60 seconds and include it in process limits.
   Close handles, fsync the raw backup, gzip with empty filename and mtime zero,
   fsync, and verify decompressed SHA-256. Only then write/fsync its receipt
   and containing directory, binding operation, source/control identity,
   census, raw/gzip sizes and hashes. Never fabricate a saved checkpoint when
   a backup fails or is interrupted.
6. At terminal, preserve raw output/WAL/SHM and incomplete backups, rehash all
   pins, and require the exact single named case to pass with no skipped,
   pending or todo case, no guard, and all owned processes reaped. A new backup
   needs independent content/boundary review before becoming a resume input.

These are requirements for a future reviewed control, not an implementation or
qualification claim. The minimal portable adapter deliberately creates **no
incremental owner checkpoints**. With only that adapter, an interrupted mutable
output is diagnostic evidence; the only admitted resume point remains the
owner-supplied gzip above. A plain shell timeout alone does not satisfy these
controls. If a suitable supervisor cannot be supplied, stop before Native.

After the actual bounded controls have been supplied and reviewed, the
operator sets the existing `nativeReleased` field to true in the external
descriptor and changes `destinationDirectory` to a fresh destination, for
example `./lan01-resume-002/suffix`. Prepare that descriptor:

```sh
node tools/handoff/prepare-lan01-cp1.mjs ../baseball-resume-input/input.json
```

That command still starts no Native work. The existing `nativeReleased` field
is not a substitute for those controls, historical authentication or a
previous run's cleanup. Then use this exact **inner command under the
reviewed supervisor**; the example directory must match the external descriptor:

```sh
LAN_RESUME_RUN="$(cd ../baseball-resume-input/lan01-resume-002 && pwd -P)"
LAN01_RETAINED_REVIEW_IMPORT_INPUT="$LAN_RESUME_RUN/retained-input.json" \
TMPDIR="$LAN_RESUME_RUN/tmp" \
NODE_OPTIONS="--max-old-space-size=1024" \
node node_modules/vitest/vitest.mjs run \
  --config tools/handoff/vitest.lan01-cp1.config.mjs \
  --reporter=json --outputFile="$LAN_RESUME_RUN/vitest.json"
```

The config selects only
[`LAN01ReviewImportResume.acceptance.ts`](../../tools/handoff/LAN01ReviewImportResume.acceptance.ts),
with a single fork and no mock aliases. That entry calls
`runLAN01RetainedReviewImportSuffix` directly. The older checked-in
`LAN01RetainedOriginalSuffix.acceptance.ts` calls the **cp24** entry and is not
the correct entry for this cp1 input.

The original loader independently revalidates gzip/raw pins and exclusively
writes `suffix/lan01-r15-cp1-pending-rights-suffix.sqlite`. It then authenticates
all retained Native owners, accepted Sources, ancestry, original enrollment,
hold, current/historical views, field/CatchWork boundaries, exact saved import
row and genuine `readCurrent` result before continuing rights. Keep every
Source, full-reference, current/historical, connection, mutation and failure
guard. A successful SQL preflight does not replace any of these checks.

## What remains and what counts as evidence

The remaining original owner-operation count is **21**: four journal calls and
seventeen terminal calls. The table names the public owner handles/methods in
the unchanged helpers, in call order. It includes expected rejection probes
and independent retries; it is **not** a count of 21 newly committed changes.

| Call | Owner API | Original Source / expected role |
| --- | --- | --- |
| 1 | Review `acceptEvent` | `lan01:journal:rights`; admit original live-appeal rights |
| 2 | Review `acceptEvent` | `lan01:journal:accept-result`; explicit official result |
| 3 | Review `acceptEvent` | `lan01:journal:next-play-fence`; reach official-ready |
| 4 | Reopened Review `acceptSession` | `lan01:journal:session`; independent retry with unchanged rows |
| 5 | LifecycleOutcome `acceptOutcome` | `lan01:terminal:outcome`; original fair-catch outcome/official closure |
| 6 | Lifecycle `acceptPrefix` | `lan01:occupied:cut25:prefix` |
| 7 | Lifecycle `acceptTotalSet` | Eleven original `lan01:occupied:cut25:total:<playerId>` Sources |
| 8 | Lifecycle `acceptView` | `lan01:occupied:cut25:view` |
| 9 | Lifecycle `acceptCalibrationSet` | Complete 32-member original cut25 calibration set |
| 10 | TerminalEndpoint `accept` | `lan01:terminal:endpoint` |
| 11 | TerminalSettlement `freeze` | `lan01:terminal:settlement` |
| 12 | TerminalSettlement `release` | Same settlement; must reject before durable effects |
| 13 | TerminalSettlement `settle` | Same settlement; original eleven participant effects |
| 14 | TerminalSettlement `release` | Same settlement; must reject before completed PA transition |
| 15 | TerminalTransition `complete` | `lan01:terminal:transition`; original application/scoring/next-play effects |
| 16 | TerminalSettlement `release` | `lan01:terminal:settlement`; release after transition |
| 17 | Reopened LifecycleOutcome `acceptOutcome` | `lan01:terminal:outcome`; idempotent retry |
| 18 | Reopened TerminalEndpoint `accept` | `lan01:terminal:endpoint`; idempotent retry |
| 19 | Reopened TerminalSettlement `settle` | `lan01:terminal:settlement`; idempotent retry |
| 20 | Reopened TerminalTransition `complete` | `lan01:terminal:transition`; idempotent retry |
| 21 | Reopened TerminalSettlement `release` | `lan01:terminal:settlement`; idempotent retry |

Review operations and independent current reads are in
[`SamePlateAppearanceLiveAppealJournalNative.test-support.ts`](../../src/host/world/SamePlateAppearanceLiveAppealJournalNative.test-support.ts).
Terminal calls, both expected release failures, durable-effect assertions and
independent reopen checks are in
[`SamePlateAppearanceTerminalLifecycleFixture.test-support.ts`](../../src/host/world/SamePlateAppearanceTerminalLifecycleFixture.test-support.ts).
Its `h.advance` retains the prefix/TOTAL/view/calibration sequence from
[`SamePlateAppearanceLifecycleFixture.test-support.ts`](../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support.ts).
Read-only assertions and constructor/close calls remain in addition to the
listed owner operations. Use these unchanged helpers; do not manually call a
subset, synthesize effects with SQL, omit expected failures or collapse retries.

All **20 original callback assertion bodies** remain in source. **16** are
historical prefix evidence; **4** remain suffix evidence. The three post-seal
read assertions are rerun as current validation. Original and sealed CatchWork
helper assertions remain separately accounted historical evidence. Completed
writers are not replayed, while the original independent journal retry is
retained. See [the original callback helpers](../../src/host/world/LAN01OriginalLiveAppealAssertions.test-support.ts)
and [the original journal](../../src/host/world/SamePlateAppearanceLiveAppealJournalNative.test-support.ts).

The four remaining callback checks cover eleven released member rows,
unchanged runner bases after the official transition, `fly_out`/zero-run
scoring, and scoring-history equality. Those are expected assertions, not a
claim that this checkpoint has already produced those outcomes. Pending appeal
rights do not establish an appeal out.

On return, retain the exact source/runtime/dependency/input identities,
supervisor terminal/cleanup result, and the one-case Vitest report. The original
helper writes `suffix/result.json`; check `continuedSuffix`,
`remainingOriginalCallbackAssertionsExecuted`, `allHandlesClosed`,
`originalCheckpointUnchanged` and `originalPrefixHistoryUnchanged`. A zero
process exit without a complete passing report is insufficient. A killed
process may never write a result, and output left after an interruption is not
an admitted new checkpoint. Do not automatically retry or combine writes from
separate attempts.

Even a successful retained suffix intentionally reports `wholeCasePass: false`.
It neither reruns all historical assertions nor proves a whole fresh LAN case,
all National cases, or a completed game. Historical private witness files are
not rechecked by the loader and must not be marked as rechecked. Byte identity,
finite-entry qualification, runtime ancestry authentication, remaining-suffix
PASS and whole-case PASS are separate claims.

## Existing evidence and remaining gaps

- Handoff validation was static only: Node **24.19.0** `--check` accepted both
  `.mjs` adapters and the `.ts` entry; JSON parsing, relative-link checks,
  excluded-metadata inspection and Git object/unchanged-input checks passed.
  This syntax-check runtime does not qualify execution under the required
  Node **26.10.0** runtime. Preparation itself, database materialization, Native
  owners, original assertions and supervisor behavior were not executed here.
- The [published retained-boundary record](../project-status/2026-10-14-live-appeal-proof-read-sharing.md#exact-retained-import-boundary)
  records source review, compiler success and the 23 finite cases in
  `LAN01RetainedCheckpoint.test.ts`, `LAN01RetainedReviewSessionSeam.test.ts`
  and `LAN01RetainedReviewImportSeam.test.ts`. These are historical results,
  not new results for this handoff wrapper.
- Native authentication and the full remaining suffix are unconfirmed. Prior
  read timings are not a forecast for this owner sequence; do not infer a
  timeout or PASS from silence or elapsed time.
- Owner delivery of the exact gzip and review of the new execution controls
  are still required. No data-free fallback or already-qualified portable
  resource supervisor is supplied here.
- Public evidence should be a reviewed summary of source identity, input
  hashes, cases/results and limits. Keep database bytes, raw output, local
  descriptors, runtime paths and unredacted reports outside GitHub. The helper's
  result can contain local paths, so do not publish it verbatim.
