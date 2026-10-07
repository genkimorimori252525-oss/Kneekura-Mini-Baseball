# Reconstructed initial participation artifact gate

This is new, bounded test source based on qualified `f65b14373f06411e5757383693811feb0c70a325` (src `90eb95c75f59d9915daee7848f9a1dead390ba87`). It does not recover the lost large artifact-support corpus. Production and the existing two small test files are unchanged. No runtime qualification is recorded here.

## Exact selection

The dedicated Vitest config includes only `src/host/world/ActualLiveParticipationInitialArtifact.acceptance.ts`. Ordinary Vitest discovery does not match its `.acceptance.ts` suffix; this private-input gate does not make ordinary `npm test` require an artifact. The dedicated gate contains one unconditional test:

`accepts genuine initial batter and defender participation with reopened Career reads and exact retries`

It rejects a missing `ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT` manifest explicitly, with no skip or fixture fallback. There is one independent original closure authentication, eight positive public Participation operations, and two absent-reserve read operations. The positive sequence is away-1 write, p2 write, close/reopen, away-1 receipt/Career/exact retry, and p2 receipt/Career/exact retry. The two reserve calls require null for away-2 receipt and Career. This is one Vitest case, not eleven cases.

The expected number of full original closure derivations from current source structure is eleven: one independent original reader, four inside the two fresh writers, and six inside the reopened receipt/Career/retry calls. This is a source-based estimate, not measured instrumentation or elapsed evidence. The gate config supplies a finite 1,800,000 ms test timeout; the coordinator must separately review/release the process cap, heap and supervision. This constant does not authorize execution.

## Admission and input

Before invoking the gate, the coordinator must have a successful official producer terminal, validated source/input lineage, the actual closed output hash, all producer processes/handles reaped, and qualified admission of that artifact under the fixed candidate source. An interrupted producer, an unqualified file, or prior-source success cannot replace those prerequisites. The test only checks same-process handles; cross-process exclusivity remains coordinator-owned.

The manifest must have exactly four top-level fields:

- `artifactPath`: canonical absolute path of the admitted closed original official artifact
- `artifactSha256`: its actual closed SHA-256
- `outputPath`: a new canonical private output path in an existing directory; it and its sidecars must not exist
- `originalReceipt`: the genuine official result in the existing `OriginalOfficialReplayReceipt` shape from `tools/verification/actual-live-pipeline/official-read-replay-helper.ts`; preserve the real original output facts, official receipt and adjudication references

The original receipt's output path/hash/main filename, realDisk, WAL mode, closed-read check and row census must match. Do not manufacture those values from an unqualified file. No template with fake receipt/closure/application data is provided. The support copies the closed original with exclusive creation, then opens only the copy for proof and writes. Empty regular WAL/shared-memory sidecars after closed read-only observations are treated like the existing official replay helper; nonempty WAL and lingering test-process handles reject. The coordinator must reject any live peer regardless of these file checks.

## Proof and preservation

The independent oracle is `actualLivePlayClosureEvidenceFromSqlite(db).read(originalReceipt.closureSourceId)` inside the existing `withSqliteReadTransaction`. It compares actual original official result/scoring/workload/controller count/physical references with the admitted producer receipt and requires `assertActualLiveClosureStage(db, proposal, true, true)`. The fixed initial fixture must be game-1/play7, originalActivation null, revision0→1, ten original unique Player/Person actors with away-1 as the sole batter and p2/home-1…home-8 as defenders. A different fixture rejects.

Expected receipts use the original actor binding, independently calculated receipt ID, authentic original proposal hash/application/play/revision, and exactly the nine V1 fields. The two Career expectations include both occurredAtDay and acceptedAtDay equal to original binding.gameDay. Oracle data is never injected into the owner. Public calls use `new SqliteOfficialParticipationStore(copyPath)` without a ParticipationAuthority. The real writer continues to rederive its own same-connection evidence before and after INSERT.

The initial fixture must contain zero participation receipts. Full row snapshots retain raw stored JSON strings and rowids for all tables; schema/index definitions and user_version are retained separately. After the writes, exactly the two expected receipt rows and canonical bytes must exist. Every non-participation row, including bindings/Match/applications/physical evidence, must equal the original. After each reopened role's receipt/Career/retry group and after reserve reads, the complete snapshot must equal the post-write snapshot. All handles close; the original main-file hash must remain unchanged, and the private output gets a new closed hash. The fixed fixture uses rowid tables; an unsupported table layout fails instead of silently reducing conservation.

## Future commands, not executed

After source/control review, candidate catalog/dependency admission, producer completion and explicit coordinator release, run these separately through existing bounded supervision in the isolated candidate:

```text
<verified-node> node_modules/typescript/bin/tsc --project tsconfig.participation-initial-artifact.json --noEmit --incremental false
ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT=<admitted-manifest> <verified-node> node_modules/vitest/vitest.mjs run --config vitest.participation-initial-artifact.config.ts
```

Use direct installed binaries so package lifecycle hooks do not silently generate the catalog. The gate emits its successful operation record and private output hash on stdout; supervisor output and terminal status remain necessary qualification evidence.

This only prepares the initial C01/C03/C04/C05/C17 acceptance path. It does not qualify all G11 sentinel wiring, D/R/O corruption coverage, W rollback witnesses, H lawful history/no-backfill, genuine consumer C3 or old-source differentials. Later-batter/final-game/roster mutation positives and the large lost corpus remain unqualified. No DB publication, CI, merge, new authority, gameplay formula or unrelated framework is included.
