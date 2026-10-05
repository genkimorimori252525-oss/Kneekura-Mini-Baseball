# Known-profile physical producer admission

The standalone pipeline accepts the separately verified
`first_base_known_profile_producer_v1` lineage, with explicit `npb-2026`
construction provenance and a same-attempt native rollback witness. It selects
one of two supported producer kinds, authenticates that kind's complete file and
semantic evidence, and rejects unknown kinds before opening a domain helper.
The existing `first_base_clean_producer_v1` contract and its 82 controls remain
unchanged. Production files under `src` are unchanged by this admission change.

This boundary validates verification evidence; the downstream owner still has
to authenticate the physical proof on its own transaction connection. It does
not turn a publication manifest into a raw receipt or enable inherited-stage
continuation. The actual official-only run is still pending as of
2026-10-05 08:49 UTC; no official/workload/next-pitch success is claimed here.

## Explicit identities

`config.physicalProducer`, raw admission and raw terminal require these same
flattened fields, without defaults:

- `fixtureRuleProfileId: npb-2026` and `ruleProfileSha256:
  158d140826d274fbfef202e495df0869ce250223c9959b26ab79e75c5d10b98c`
- `originalConstructionDatabaseSha256:
  60525735348ea48aeb1944e7c1b2dc2d3afd6fdac8961d83486d2f4a4c6df0f4`
- `originalConstructionTerminalSha256:
  215e7ad43ac770f0423405a658721467032f0a5151449fa2cb4d9af422850209`
- `originalConstructionSourceCommit:
  23e4ef0cd34fbd028b6d3b689188a741cde2bea1`
- `originalConstructionSourceManifestSha256:
  567ce51ccd34c5522e78b6eef99b7d85b4651d640a3e9277d89865b628cb0896`
- `preEndSourceCommit` and `preEndSourceManifestSha256`: explicitly pinned to
  the pre-end input manifest's `sourceCommit` and `sourceManifestSha256`

The pre-end manifest retains
`synthetic_first_base_known_profile_pre_end_fixture_v1`, `ruleProfileId`,
`ruleProfileSha256`, and those same four `originalConstruction*` fields. Its
database hash is the **fresh completed pre-end output**, not the constructor
database or legacy a546 input. The admitted real pre-end output is
`64fc22bf43b656492aad85b6a8042e3862bd4fcf8132482cceca5f6109e8dc71`.
Pure test fixture hashes remain expressly invented identities.

The end producer's `sourceCommit`, `sourceManifestSha256` and `sourceFiles` remain
separate from the pre-end Source identity. Its before/after Source manifests use
the existing strict plaintext `sha256  relative/path\n` format. The known pre-end
cut is 56d96a7728d21dc3b250e4e0bb5d8722fbc023c7, with JSON Source-manifest hash
020e8e1dd20e7e85fd524fdb0d3ce7eb37d04231e5718c9c128478f15d55fcc4. This is the
timeout-only correction to the earlier f86a7de cut. A later end cut
must not silently rewrite or inherit those pre-end pins.

## Fifteen file references

Terminal and output are pinned through the existing outer configuration fields.
`physicalProducer.files` adds eight direct references: admission, results,
artifactAudit, inputManifest, sourceBeforeManifest, sourceAfterManifest, runtime,
and originalInput. `controls` adds exactly audit-artifact.mjs,
run-known-profile-acceptance.py, worker-memory-telemetry.cjs, and
worker-resource-probe-exact-node26.cjs. `negativeEvidence` adds exactly
seal-insert-rollback.json. All fifteen normalized absolute paths must be distinct,
and every reference supplies an explicit SHA-256. Control and witness basenames
must be exact. No directory scan, guessed neighboring path, current-workspace
authority, or default hash is accepted.

Raw input/runtime/control paths must equal their explicit file references.
Admission and terminal carry `inputManifestPath`/`inputManifestSha256` as well.
For this new kind only, `negativeEvidencePath` is the explicit future witness FILE
path. Admission has no `negativeEvidenceHashes`, because the assertion has not
run. Terminal, configured evidence and independent file observations require the
same one-entry `negativeEvidenceHashes` map. Old v1 directory semantics and
published negative-proof rules remain unchanged.

The adapter hashes/decodes the same JSON bytes, uses streaming file hashes for
binaries/databases/controls, and never opens SQLite or imports a domain helper.
It rejects pending or publication-projected terminal bytes before any other
file. Raw admission/results/audit projections are rejected before the physical
artifact is touched. All four raw objects reject top-level kind, schema,
publicationProjection and originalRawReceiptSha256; nested metadata and the
supporting input-manifest schema remain valid.

## Same-attempt native rollback witness

The native acceptance test writes `known_profile_seal_insert_rollback_v1` during
its verified rollback boundary. Admission must bind its Source commit/manifest,
profile, input and input-manifest hashes; exact request; and actualWorkerPid to a
successfully observed actual fork. The witness must contain the exact SQL
`INSERT INTO actual_live_play_fences VALUES(?,?,?,?)`, observed endRows=1 and
sealRows=1 with dependencySnapshotHash=`changed-during-seal`, then zero end/seal
rows after rollback. Its before/after original-table lists must equal the input
manifest's complete original tables, and both SHA-256 digests must hash the exact
JSON-serialized lists. Rehashed altered or truncated lists are still rejected.
A publication projection, old negative-proof hash, launcher PID, or another
attempt's input/Source cannot substitute for the native witness.

Success retains exact raw gate/unchanged flags, child exit zero, null stop status,
two exact named native acceptance tests passed with zero failed/pending/skipped,
actual Node 26.10.0 worker evidence with 1024 MiB requested old space and 1120 MiB
heap, and no process left after reap. Output must be the pinned ended-chain.sqlite
with one requested physical end and one seal, conserved complete original table
census/counts/digests, and absent/empty input/output WAL. The downstream owner must
still perform its same-connection proof; JSON admission never replaces it.


## Verification and exact source qualification

The first 261 new pure tests on `2add332963582d156819cd769719de455d9c6b23`
observed 11 controls passing and 250 intended rejection failures, with zero
skips. Independent review found four omitted success flags:
`inputManifestUnchanged`, `preEndTerminalUnchanged`, `configUnchanged`, and
`outputUnchangedAfterAudit`. Their false, missing and truthy-string cases
produced 12 intended failures on `785ee9aed3539feb21c67cd6c7fd982c091126a5`
(343 other passes). The repair requires each flag to be exactly `true`.

The final frozen official-dispatch source is
`6eb9dd6d6d46d6c6e9f8f2282b9b5ab45129bade`, with 2,120 tracked files and
source manifest SHA-256
`2b8b616ed8342af6005f6c3293c30c06a350a0f99addfee892fbb2db4bad0817`.
The published executable modules and tests are byte-identical to that source;
publication additionally carries the already verified synthetic fixtures and
updated documentation. This is source qualification, not a new whole-suite run.

Verified on that exact frozen source, using Node 26.10.0:

- Full TypeScript compiler: exit 0, 29.312 seconds, peak 1,301,612 KiB aggregate
  RSS, actual 1,504 MiB heap
- All 355 pure admission controls: passed, zero skips, 1.316 seconds, peak
  162,268 KiB, actual 288 MiB heap; this includes the original 82 legacy controls
- Existing official helper import: passed; no physical owner executed
- Actual 15-file producer admission: passed in 0.566 seconds at 71,640 KiB;
  SQLite and domain helper imports were blocked, and all explicit pins remained
  unchanged
- Positive official supervisor smoke: passed in 3.214 seconds, exit 0, all
  owned processes reaped; it did not execute an official domain operation

Source, controls and inputs stayed unchanged. Receipt SHA-256 values:

- Compiler/controls/import:
  `439685515788416f7e0c91b5b252a34885e681473249f90eb6e4097a3234bf6e`
- Actual file admission:
  `47216f81534e628c9462d15e44f81712b813e2e566100505f89e986a2092d85a`
- Smoke outer terminal:
  `48ef5cd101f4f5bdb5e69b3816035306d99923273418524e68228beae4d10940`
- Smoke supervisor terminal:
  `8f3d750eb8a7af8fcaf3a2f35abd282cc0f49d6d33f963d8d7f8dd58316c0947`

The separately passed physical input is the fresh ended database
`585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a`,
with raw terminal
`02531e471eb2130a800c76e44e1e5f6d6daa108049c5ceb25357cc1b4c4eaa0a`.
That native gate passed 2/2 with zero skips, including seal-insert rollback,
clean commit, close/reopen and exact retry. Its result does not establish the
pending official, all-role workload or actual next-pitch stages. The latest
completed cumulative regression remains PR277; later cumulative verification
is still required.
