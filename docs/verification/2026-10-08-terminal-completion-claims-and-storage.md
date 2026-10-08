# Terminal completion rejection metadata and storage capability

This record describes the earlier metadata/storage-only cut. The successor implementation and its separate qualification are recorded in `2026-10-08-terminal-continuing-completion.md`.

This source-only preparation extends the approved continuing terminal-K post-play contract. It grants no successful completion, controller retirement, scoring repair, workload settlement, next-actor admission or next-pitch authority.

## Storage boundary

`ActualFoulTerminalApplicationStorage.ts` owns the exact legacy, acknowledgement and completion CHECK schemas. Default admission accepts only those three schemas. The acknowledgement requirement accepts only acknowledgement or completion; the completion requirement accepts only completion. The completion CHECK retains every old arm and adds `POST_PLAY_COMPLETED_CONTINUING` with non-null `result_json`.

The validator uses only reads against existing storage. No migration or missing-table creation was added. The established legacy queue initializer is unchanged; a completion operation must separately require already installed completion-capable storage. Existing scoring/workload validators retain their calls to the same acknowledgement-capability check and their own exact storage checks.

The former storage block in `ActualFoulTerminalApplicationEvidenceFromSqlite.ts` was extracted and reexported. Its proposal, ancestry and public-evidence behavior is otherwise unchanged. Both evidence readers still reject completed stages in this preparation; schema admission is not archive admission.

## Raw identity boundary

`ActualFoulTerminalCompletionMetadata.ts` shares rejection-only discovery across terminal and official ownership. The existing duplicate-key/escaped-key/array-aware SQLite traversal is preserved.

- Terminal Source, setup Source, completion ID, application ID and reference/hash domains remain distinct.
- A versioned completion ID explicitly links its terminal and setup elements. A versioned terminal scoring ID explicitly links its terminal element. Noncanonical whitespace/escaping can still expose a raw claim; neither ID decoder authenticates an archive.
- Full completion Source/reference paths and compact application references are discoverable. Stray completion metadata in a Match remains discoverable even though its valid activation envelope is still only activation/nextWorld.
- The setup Source hash and completion snapshot hash never form an edge merely because their literal bytes coincide.
- Original scope uses the original game and `previousPlayId`. `nextPlayId` and a next Match's `playId` never substitute for the consumed PA.
- `foulTerminalPostPlaySetupIdentityRows(db, setupSourceId)` scans all surviving terminal result metadata without depending on the cached terminal Source ID, scope or hashes. It returns raw rows only. A matching row may introduce further same-domain claims through fixed-point linkage.
- Official discovery revisits raw terminal bridges when an official claim introduces another alias, so a malformed peer cannot hide behind a later-discovered setup/reference edge.

### Completion-owner consumption contract

The census signature is `(db: Pick<DatabaseSync, 'prepare'>, setupSourceId: string) => FoulOfficialRow[]`, with `FoulOfficialRow = Record<string, SQLOutputValue>`. It validates a nonempty, trimmed setup identity and reads `main.actual_foul_terminal_applications`. An absent optional table returns an empty array; an installed non-table or missing/wrong-typed declared discovery column throws. It does not assert the full storage CHECK/uniqueness schema. The completion owner must separately require its exact storage capability.

Each return value is a complete raw database row. No JSON parse/reconstruction, stage conversion, accepted-input callback or effect authentication occurs. Cached IDs may be null or foreign. Ordering uses the existing deterministic raw-row key; equal-valued physical rows remain separate returned entries. The fixed point can include an indirectly connected malformed row with no surviving direct setup field. Callers must not filter such rows away before deciding whether ownership is ambiguous, and must not cache this census across callbacks or writes.

A compact application reference contributes `terminalSourceId` to the terminal Source domain, `setupSourceId` to the setup Source domain, `sourceHash` to the setup Source hash domain, and `snapshotHash` to the completion snapshot domain. Its `completionId` also contributes its full literal identity; only the supported versioned three-element array additionally links terminal/setup elements. A malformed or missing `version` field does not suppress raw discovery. The strict archive decoder remains responsible for exact version/field/byte validation.

Terminal ownership seeds terminal/application/closure identities or the requested setup identity, then grows only same-domain edges from selected raw rows. Official ownership starts with the requested terminal scope and terminal claims, visits application/Match/legacy-closure mirrors, and revisits terminal rows when an official claim reveals a new setup/hash edge. The original Match row is always included as baseline, but its unrelated historical activation does not seed identity growth. A raw Match `completion` field is rejection metadata only; this change never broadens the canonical Match envelope.

### Wholly orphan official setup references

`officialApplicationPostPlaySetupIdentityClaims(db, setupSourceId)` independently seeds only the setup identity domain. Its exact return type is `OfficialApplicationOwnershipClaim[]`: each item contains `table` (`applications`, `matches`, `physical_play_closures` or `actual_live_play_closures`) and `row` (`Record<string, SQLOutputValue>`). It does not return a terminal row under an official table label and does not add an unrelated baseline Match.

This census discovers a surviving compact application or Match `setupSourceId` even when all terminal/completion IDs and hashes are absent, foreign or malformed. It also handles full Source/controller-retirement and supported encoded setup paths in legacy official mirrors. Subsequent same-domain completion/Source/hash edges are expanded through all raw terminal and official peers to a fixed point. An absent terminal table does not suppress an official-only claim. A literal setup ID in another identity/hash domain does not seed ownership.

A fresh-completion or callback-free retry guard must consider both the terminal setup census and this table-tagged official setup census on the writer's current snapshot. A wholly orphan official claim, a foreign surviving owner or multiple owners requires rejection; selecting a single row is still not proof. Accepted-input, immutable ancestry, exact completion decoding, mirrors and effects must be authenticated by their respective owners. Neither census repairs an archive, invokes an acceptance callback or writes anything.

Callers must authenticate every returned row and enforce uniqueness before granting any accepted-input, completed-effect or historical-retry authority. An empty census does not invent missing proof.

## Test attribution

The new tests use deliberately malformed synthetic SQLite metadata and schemas. They create no physical fixture and establish no genuine successful terminal completion.

- Storage RED: four intended missing-capability failures and two existing-boundary passes; then six GREEN cases. An initial RED control expected an untruncated error string; the corrected exact rerun verified all intended failures. A seventh compatibility case verifies every preserved SQL CHECK arm and result nullability.
- Metadata RED: ten intended missing-discovery failures and three compatibility passes; then thirteen GREEN cases.
- Extension RED: three intended missing retirement/cross-owner discovery failures with the earlier thirteen cases passing; then sixteen GREEN cases.
- Official setup-census extension RED: four intended missing-API failures with the earlier nineteen metadata cases passing; then all twenty-three metadata cases GREEN.
- Retained-original-game scope extension RED: the new scope matrix failed while the earlier twenty-three cases passed; then all twenty-four metadata cases GREEN. It pairs the completion previous play with surviving original pending/acknowledgement game markers when cached game IDs are damaged, while refusing foreign games and next-play-only matches.
- Final focused set: twenty-four metadata cases and seven storage cases. Loops cover plain and recursively escaped/duplicate/array forms, all declared reference/hash paths, setup alias census, wrong owner/version/identity-domain cases, original-play scope, missing storage and no-write assertions.
- Combined bounded compatibility invocation: 291 assertions in 21 files, represented by 24 Vitest suites. The four official setup-census additions and retained-original-game scope matrix bring the final bounded selection to 296 assertions. The intermediate 295-case gate also passed its exact supervisor checks. The existing 265 cases cover pending/acknowledgement metadata and storage, immutable ancestry, scoring/workload metadata and storage/transactions, shared official writers and existing activation-reader compatibility. All 291 assertions were observed passing. Two preliminary supervisor receipts undercounted nested suites; this was a control-manifest error, not a failing product assertion. The corrected exact supervisor gate subsequently passed with all 291 assertions, original child exit 0 and no remaining owned processes.
- Focused TypeScript compiler and full root TypeScript compiler passed. The first storage-only root compiler attempt lacked the clone's ignored `GeneratedClubCatalog.ts`; it passed after copying the unchanged existing generated catalog. No catalog or physical-fixture regeneration was performed.

All execution gates are bounded, source/dependency/runtime-pinned, single-worker controls with heap/RSS/wall caps and owned-process reaping. The full project test suite and genuine terminal completion/retirement/three-write/next-actor/next-pitch qualification were not run or claimed by this slice. No home-PC CI, publication, merge or deployment was performed.
