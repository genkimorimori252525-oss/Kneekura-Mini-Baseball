# Bounded candidate-source admission for the genuine official artifact

Preparation only. The producer passed; this candidate's read compatibility and initial participation writes have not run. This addition reuses `verifyActualOfficialReadReplay` unchanged and prepares the already-reviewed initial gate's genuine four-field input. It does not use the old ancestry-sensitive admission wrappers, introduce a replacement authority, or change any production, initial test/support or small-test bytes. The initial gate config has only the coordinator-requested external-cache contract added.

## Exact producer pins

| Item | Pin |
| --- | --- |
| Producer source | e58db66ff423fd58b90dfc183f4bc66021e9c2c8; src a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75 |
| Terminal | flow1/checkpoints/official-terminal.json; SHA-256 618195ca8e674d47304d1b35d3ddfddd9357666958180cb185585dbde27b1c93 |
| Producer receipt | flow1/official-receipt.json; SHA-256 2a361e32f3f9728291db949b98e7d8f6276f9157ba484bcfe3a007800a9e1c46 |
| Artifact | flow1/official.sqlite; SHA-256 7d23d7006075f57685bbd3998ca8f92b5a01e3802d0f2c911a3e882b0032a953; 3,579,904 bytes |
| Shared flow root | /workspace/shared/baseball-closed-continuation-controls-20261007 |

The terminal points to the receipt outside the checkpoints directory. Both JSON hashes were verified during source preparation; the DB was not opened or read. The producer receipt is a `fresh_closed_input_phase_receipt_v1` envelope whose `result` is `verifyActualLiveOfficialArtifact`'s output. Its genuine official receipt is therefore `envelope.result.result.official.receipt`.

The source transition is substantive. Producer e58db66 → initial candidate 9a1a113 changes 84 src paths, including original closure/physical readers and differences in paired-read, stance/runner and foul slices. This admission is an actual compatibility gate, not a presumption that only six participation files differ. If it rejects, diagnose and review the source transition using already-qualified changes; do not alter the artifact, substitute proof or weaken this gate.

## Mapping and real observations

The adapter pins and reads the exact terminal/receipt, checks successful/reaped/verified producer state and their source/input/receipt links, and obtains these expected values without fabrication:

| OriginalOfficialReplayReceipt field | Genuine producer field |
| --- | --- |
| closureSourceId / applicationId | envelope.result.closureSourceId / applicationId |
| officialReceipt | envelope.result.result.official.receipt |
| scoring / workload | envelope.result.result.scoring / workload |
| retiredControllerCount | envelope.result.result.controllerReset.retired.length |
| adjudicationEvidence.physicalEndReference / wholeHistoryReference | envelope.result.adjudicationEvidence corresponding fields |

`output` cannot be copied from this producer because the producer does not emit that shape. One real read-only DatabaseSync connection, guarded by the existing `withSqliteReadTransaction`, observes database_list, WAL mode, all non-internal table counts and workload activity kinds. It requires total_changes=0, a closed transaction and connection, no remaining same-process DB handles and unchanged actual closed main-file hash/size. Only after those checks does it set `wrapperReadOnlyOpenClosedVerified: true`. This first pass is a metadata census; it is not original physical authentication.

The adapter then calls the unchanged `verifyActualOfficialReadReplay` once. That helper opens two separate read-only connections and transactions, rederives the original closure/actors under candidate code, checks the current Match exactly, compares the independent producer receipt expectations, requires role-workload planning still pending, and checks equal observations, unchanged bytes and closed handles. `prepareActualRoleWorkloadPlan` only reads the already-authenticated context; it does not apply a settlement or activation.

Before and after the reads, the adapter checks candidate Git commit/src/clean tracked state and requires all executing gate/entry/config files plus the reused replay helper to be tracked and byte-identical to HEAD. An untracked adapter cannot claim its base commit's identity. After both reads pass it also rechecks original file hash and producer JSON pins. It writes the admission result with exclusive creation, then writes the exact four-field initial manifest last: `artifactPath`, `artifactSha256`, `outputPath`, `originalReceipt`. No manifest is emitted on a replay rejection. Output paths are new, distinct, outside candidate source and cannot overlap producer files/sidecars or the initial output DB/WAL/SHM namespace. No private DB is copied or written during admission; the later initial gate owns that copy.

## Input, compiler and commands

The dedicated entry is `ActualLiveParticipationAdmission.acceptance.ts`; ordinary *.test.ts discovery ignores it. Missing `ACTUAL_LIVE_PARTICIPATION_ADMISSION_INPUT` fails explicitly. The supplied admission input JSON has exactly:

- `candidateCommit` and `candidateSrc`: exact frozen candidate identities; checked against the actual source root resolved from the adapter module
- `initialOutputPath`: new private DB path for the later write gate, never created during admission
- `initialManifestPath`: new file to receive the genuine four-field manifest after successful reads
- `admissionResultPath`: new file for mapped receipt, source transition, both observations/timings and manifest hash

Each output parent must already exist and be canonical. The coordinator must separately admit catalog/dependency/Node identities, establish cross-process quiescence and own bounded serialized execution. Same-process handle checks do not prove that no external process is using the DB.

One scoped compiler now includes both the admission and initial acceptance entries and both explicit Vitest configs:

```text
<verified-node> node_modules/typescript/bin/tsc --project tsconfig.participation-admission.json --noEmit --incremental false
BASEBALL_GATE_CACHE=<absolute-external-cache> ACTUAL_LIVE_PARTICIPATION_ADMISSION_INPUT=<five-field-input> <verified-node> node_modules/vitest/vitest.mjs run --config vitest.participation-admission.config.ts
```

Both opt-in configs require the existing absolute `BASEBALL_GATE_CACHE` external-cache contract and set `test.cache: false`, matching the coordinator's v5 config; this keeps transforms and test results outside pinned source/dependencies. The admission config selects exactly one test, one worker, no file parallelism, and a proposed finite 900,000 ms test timeout. Supervisor wall/heap/RSS limits and the exact environment variables require concrete coordinator review; a fixed 60-second generic test control is incompatible with this selection. These prepared commands do not authorize execution.

Only after the admission's actual outer/controller/child terminal, preserved inputs and emitted manifest/hash are qualified may the separate existing initial gate run on the same frozen source:

```text
BASEBALL_GATE_CACHE=<absolute-external-cache> ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT=<qualified-emitted-manifest> <verified-node> node_modules/vitest/vitest.mjs run --config vitest.participation-initial-artifact.config.ts
```

## Cost and remaining scope

Admission is one cheap raw-census read plus two complete original authentications. The later initial gate retains its source-estimated eleven original derivations (one oracle + four write proofs + six reopened calls). Combined planning count is thirteen complete original derivations plus metadata reads, not thirteen Vitest cases. Actual candidate timings are unknown. The producer terminal's 1,218.163763697 seconds covers a different multi-operation producer phase and must not be divided into a claimed per-read estimate; historical old-source timings also do not qualify this candidate.

Installed Vitest 2.1.9 runner source queues task updates through a 10 ms timer and calls the test function before constructing its timeout timer. A synchronous long proof can delay reporter updates and timer handling; the supervisor's process wall cap is therefore authoritative. Existing original artifact test patterns are async to await SQLite backup and then perform synchronous owner calls. No source evidence establishes that adding an async keyword alone would improve RPC behavior, so no speculative asynchronous rewrite is included. Runtime terminal/report completeness still has to be observed and qualified.

This patch adds no large D/R/O/W/H corpus, synthetic accepted rows, new physical/read authority, source repair, formula, public DB or pipeline framework. All previously unqualified participation obligations remain unqualified after admission alone.
