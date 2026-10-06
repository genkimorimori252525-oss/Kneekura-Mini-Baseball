# Player body/capability materialization: bounded composition contract

Status: **source-only contract and unexecuted RED candidate**. Base `e2089f8bc8e88507add6450bb5e8fc67af86bdf1`, production tree `183e367eda89426b32707bb1d5d5e108ddc59455`. No runtime, compiler, catalog, database, or publication was used to prepare this slice. Implementation must wait for coordinator-observed RED.

## Approved boundary and direct source evidence

- Remaining checkpoint §5.7–8 and `2026-10-05-nonvisual-remaining-matrix.md`: compose general body/capability inputs; preserve explicit accepted calibration.
- Realism `03-roadmap.md` P3: derive body origin and leg/glove/tag reach from `PlayerPhysicalProfile`; never grant success-rate or skill bonuses from body size.
- Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, Canonical 32 §2: one global Player/Person. Its legacy `-DRAFT` filename is explicitly superseded by its approved Canonical status; no earlier unapproved draft is used here.
- The same Foundation revision, Canonical 55 §§5/14/18: preserve physical body/release provenance and frozen historical release selection, with independently accepted dimensions and calibration.
- Canonical 53 §2: generation/development priors do not constitute current ability, and label projections do not create ability.

Directly inspected existing owners:

1. `PlayerMaterializationRuntime.materializeAcceptedPlayerPerson` already owns intake → Person/genesis composition. It remains unchanged.
2. `PlayerPhysicalProfile` currently supports height only. `deriveDefenderPhysicalReachCalibration` already derives height scale, body origin, leg reach, glove reach and tag reach from the explicit baseline. The adapter must call that kernel, not duplicate its arithmetic.
3. `SqlitePlayerFieldingModelStore` owns immutable Person-linked ratings, transfer parameters and throw calibration. The adapter selects and verifies this owner; it does not rewrite or generate these values.
4. `SqlitePlayerReleaseGeometryStore` owns historical accepted body and release profiles. The pitcher selection uses the original at-day snapshot, never a newly generated release or the latest head substituted for that day.
5. `SqliteBattedWorldContactStore.AcceptedBattedWorldModel.actors[number]` already defines the five-part actor schema: glove, body, tag hand and two feet. Preserve legacy reader behavior and archive bytes; the narrowly marked materialized-model route below adds its own native provenance checks.

## Smallest new seam

Expose `openSqlitePlayerBodyCapabilityMaterializationStore(path, authority?)` through `PlayerMaterializationRuntime`. A separate implementation module may own it. The test imports the existing runtime namespace and asserts the new callable exists before creating its database fixture, so current-source RED is a meaningful assertion rather than an unresolved import or an always-skipped test.

The actor seam has `accept(sourceId)` and `read(sourceId)`. `accept` returns either `{kind:'materialized', value}` or `{kind:'pending', missing}`. `read` returns the immutable successful receipt or null. No partial receipt is written for pending or rejected input. The concrete model-consumer seam is `acceptModel(sourceId)` plus `readAcceptedModel(sourceId)`, described below. The store also has `close()`.

The test-support types are the precise proposed input/output contract; they are not production code. The request contains:

- immutable materialization source ID/version and career/Player/Person/intake-source scope;
- `atDay` and `role`: defender, pitcher, batter or runner;
- explicit `{sourceId, sourceVersion}` pins for body, pose and reach calibration;
- an existing fielding model pin for defender/pitcher;
- an existing release snapshot pin `{sourceId, sourceVersion, effectiveDay}` for pitcher.

Body evidence contains an accepted-at day, the same Person scope, and an accepted `PlayerPhysicalProfile`. Pose evidence contains the same scope, its exact body pin, an accepted-at day and all five supplied primitives. Reach calibration contains its own ID/version/accepted-at day and the existing `DefenderPhysicalReachBaseline`; it may be a shared calibration and is not a second Person record. Optional body `displayLabel` is diagnostic metadata only and must not affect physical output.

The accepted-source callbacks load only the materialization request and body/pose/reach input records. There is deliberately no callback granting the caller authority to supply a Person, fielding capability or release snapshot. Those are read through native owners on the materialization writer's database connection.

## What is derived and what is only accepted

For each successful actor:

1. Verify the original Person link and every supplied source pin/day/scope.
2. Validate the accepted height using the existing profile boundary and call `deriveDefenderPhysicalReachCalibration(profile, baseline)`.
3. Set actor `heightMeters` from the accepted profile and `bodyOriginHeightMeters` from that derived reach. Reject a derived origin outside the existing actor height envelope.
4. Copy the five independently accepted pose primitives exactly; do not scale their radius or offset from height.
5. Select the exact existing role model, checking its source ID/version, original Person and day. Preserve ratings/calibration unchanged.
6. For pitcher, select the exact historical release snapshot and compare the supported shared body dimension (height). Pose/body provenance does not prove shoulder height, arm reach, posture or nominal pitch velocity/spin; those remain owned by release/execution sources.

The output actor is assignable to `AcceptedBattedWorldModel['actors'][number]`. Reach remains a separately named intermediate. The receipt records whether inputs were accepted or derived through its source fields; it must not describe caller primitives as generated anatomy. No outcome, ability coefficient, locomotion parameter, speed, spin, new biology, or hidden generation prior is produced.

## Concrete existing game-model consumer

The optional authority callback `readAcceptedModelAssembly(sourceId)` supplies the existing game/fixture/venue/version/day/grip/surface fields plus ordered `{playerId, personId, materializationRef}` entries, an explicit `atDay`, and `kind: 'body_materialized_batted_model_v1'`. It supplies no actor dimensions. `acceptModel` verifies actual official participant bindings and original native actor receipts, and assembles the existing `AcceptedBattedWorldModel` actor fields from those receipts. It preserves supplied grip/venue/surfaces exactly and does not derive them. Each receipt must match the requested identity, version, career and day. The accepted assembly supports the existing model's registered actor superset, not an invented limit of ten entries.

The immutable model-source manifest is stored as `world_batted_body_materializations` with source ID, canonical source/snapshot JSON and their hashes. `source_json` is the accepted assembly and `snapshot_json` is the derived tagged model itself, including its original source ID and materialization reference. This second composition record is necessary to retain the model → exact actor receipt relationship. It has no game head and does not supersede a model. It is neither another geometry store nor a replacement for `batted_world_models`.

`readAcceptedModel` returns the existing model fields plus the additive discriminator/reference below and is used directly as `openSqliteBattedWorldContactStore(..., {readAcceptedContact, readAcceptedModel})` authority. The existing contact writer owns actual Batted World publication, live-play admission, actor set/game/fixture validation and frozen archived geometry. The test must use that production consumer and inspect its physical primitives, not merely assert an unused receipt. Reopen of the old contact archive must work without this new authority.

The output extends the model with `kind: 'body_materialized_batted_model_v1'` and `materializationSourceId`, which must equal the exact accepted assembly/source ID in this slice. The production model type becomes an additive union: the unchanged legacy shape forbids those two keys; the new shape requires both. `sourceVersion` remains opaque accepted provenance. Even a legacy record whose sourceVersion happens to equal the new kind string remains legacy. No previously legal sourceVersion is reserved or reinterpreted.

For the new kind, both prospective contact acceptance and native archived-model replay must read and verify the exact immutable model manifest/actor receipts on their own database connection. Missing manifest is an error, not a legacy fallback. A legacy-shaped row must also be checked for an existing materialization claim under its model source identity; if a claim exists, the reconstructed tagged model must match. Removing kind/reference and recomputing both the model and contact hashes cannot downgrade it. This narrow reader/writer connection is necessary: the current contact archive otherwise stops asking its external model authority after publication and would lose the source relation. A trigger deleting the manifest during contact publication must roll back the physical-model/contact writes and restore the manifest.

Follow the bounded namespace pattern already in `SqliteBattedVenueLegalPolicyStore.policyOwner`: inspect `main.sqlite_master` without installing schema during reads; read only the original main owner; discover source identity in scalar keys and every exact `source_json`/`snapshot_json` claim through `sqliteJsonMetadataNodes`; reject moved/duplicate/inconsistent claims. Enumerate the model ID/reference as well as the manifest's own ID so a relocated index or alias cannot suppress the original materialization ownership. Preserve enclosing read/write transactions. Do not add a broad capability registry, reserve opaque provenance versions, or allow TEMP/attached fallback to replace missing main authority. A pre-feature database with no materialization tables remains readable through the legacy branch.

The source audit found that `AcceptedBattedWorldModel` allows a registered actor superset; the current fixture enumerates all bindings. Neither fact guarantees that an arbitrary accepted ten-actor model covers a later batter such as `away-2` or an eligible runner. A requested actor with no materialization receipt fails explicitly. A model omitting a later required actor must be rejected by the existing actual-actor validation, never filled with the earlier batter's dimensions. The separately owned repeated-play slice handles binding a later actual play to its appropriate accepted geometry; this slice does not change `sameModel(gameId)`, mutate old model snapshots, change a next-play source or invent missing actor inputs.

Native batting remains separately owned and may pin an actor receipt plus its explicit batting-specific stance/readiness/capability source. This contract does not infer pre-commit batter COM or eye pose from the legacy swing-derived root.

## Missing input versus false provenance

- An explicitly null required body/pose/reach/role-model pin means input has not been supplied: return pending, with no actor and no write.
- A nonnull pin that cannot be found, has the wrong version, is future dated, belongs to another Player/Person, or disagrees with the pose's body pin is invalid: reject. Never substitute a default, another source, the latest body, or caller geometry.
- Defender/pitcher require fielding evidence. Batter/runner do not acquire fielding, batting or runner capability from body dimensions; their fielding pin must be null in this v1.
- Pitcher requires a release pin. Other roles must have a null release pin.
- Supplied evidence is still validated before returning pending for a different absent input. A pending calibration must not mask a wrong Person or a fabricated source.

## Durable ownership and writer seam

A successful materialization needs one immutable receipt table, `world_player_body_materializations`, because the three independently accepted parameter records have no universal existing durable owner and replay must not ask a mutable caller to regenerate them. The table stores indexed receipt identity/scope plus canonical `source_json`, `source_hash`, `snapshot_json`, and `snapshot_hash`.

This is a composition archive, not current body state: no body head, body revision counter, body mutation API, per-role Player copy, automatic newest-source selection, ability baseline, or growth writer. Its snapshot archives exact original accepted parameter payloads together with pins, actual owner selections and derived output. Multiple explicitly named receipts are permitted. A reused body/pose/calibration source identity must resolve to the same original payload across receipts; a different receipt ID cannot launder a changed payload under an old pin. New measurements require new source IDs/versions and independent acceptance, not edits to existing receipts.

Before first write, validate original Person and applicable model owners on the writer's connection in one owned transaction. After insertion and before commit, re-read all those owners and the inserted receipt on that same connection; compare to the originally pinned inputs/output. Trigger-local deletion/mutation must be visible and roll back both the receipt and the owner mutation. Do not use a second connection or caller-provided reader as the final writer check. Historical release selection may need its existing replay reader exposed for use on this connection; do not reimplement a weaker release validator.

Reopen without authority reconstructs the actor/reach from archived parameter evidence and revalidates original native Person/model/release evidence. It does not promote a caller label, current fielding model or a future release into the original receipt. For release, first admission checks the current at-day selection; replay/retry validates the originally pinned snapshot and its original native history prefix. A legitimate later history append, including a change effective on the original receipt's day, must not retroactively replace its release selection or invalidate it. A newly admitted receipt still must select the applicable at-day source and cannot reuse that now-stale pin. Use the existing history's exact source identity and validated prefix, not an independently implemented release history or today's `selectAtDay` result for replay. Changed canonical JSON, hash, scalar/index mirrors, or ambiguous source claims reject reads and retries. The original source claim must remain discoverable if its scalar source ID is moved. The old intake, release, fielding and Batted World readers remain independently usable and byte-compatible.

## RED cases and limits

The proposed tests cover real native Person/fielding selection; exact actor schema; a supported accepted height change that changes derived body origin and reach; display-label neutrality; unchanged supplied primitives and skills; pending without writes; missing/future/wrong Person/wrong-version/wrong-body inputs; invalid/duplicate primitives; fielding scope/version/day; pitcher historical source/height agreement; immutable cross-receipt source pins; writer-local mutation rollback; authority-free reopen; archive corruption/moved claims; and old owner compatibility.

These tests have **not run**. No compiler, RED, GREEN or aggregate PASS is claimed. At the assigned base the new callable is absent by source inspection. The coordinator must run the focused tests after the runtime hold is lifted, observe the expected absent-composition assertion, then authorize the production implementation. If the test instead fails to compile or initialize its fixture, fix that test defect before implementing.

Not proved by this source-only slice: any executed game-model/physical-adoption result; complete world-population body generation; calibration validity across a population; anatomy from height; repeated-play aggregation/adoption; new batting or runner abilities; a calibrated pitching velocity/spin generator; causal growth of general skills; or current integrated runtime/archive acceptance. The authored consumer case is a verification target, not runtime evidence. The existing full-suite and archive gates remain with the coordinator.
