# Actual-live per-play scorer Source: preparation contract

Status: coordinator-reviewed contract with test-only preparation; no production implementation and no execution gate performed.

Audited base: `8a481a3d574d01f06acba5509baa0c73cea140a3` (public PR #320 local source). Branch: `codex/prepare-actual-scoring-source-2026-10-05`. This preparation is outside the cumulative verification cut. Gate 34927 retains all execution locks.

## Prepared test-only checkpoint

`src/host/world/ActualLiveScoringAdmission.test.ts` prepares 23 focused cases. `ActualLiveScoringContract.test-support.ts` defines the proposed Source and adapter API; the future `openSqliteActualLiveScoringStore` is expected to be re-exported by the existing `SqliteActualLivePlayClosureStore` entry module. It exposes `enqueue`, `read`, `resume`, `submit`, and `close`; `resume`/`submit` return the unchanged existing `PersistedOfficialScoring` shape. The proposed `actual_live_scoring_sources` table uses `QUEUED`/`SCORED` status and preserves immutable Source/proposal bytes. The adapter opens the existing scoring writer, so its empty canonical scoring table is available before admission.

The fixture reuses the existing domestic test setup and real closure, Match, ten-role workload and readiness owners. Physical/adjudication readers and the review projection reader are explicitly substituted with persisted fixture input rows. The real closure review-pin selector is exercised; the review journal itself and original physical derivation are **not** certified here. Safe fair-ball setup and accepted scorer values are synthetic test inputs, never reconstructed genuine SAFE evidence or production calibration.

The prepared cases cover accepted H/E, missing/unapplied/unsupported input, exact Source and effective closure bindings, outcome-neutral stale review heads, immutable competing Source admission, actual INSERT/AFTER INSERT corruption witnesses, and interruption before scoring or after its commit but before checkpoint completion. Recovery closes the known owner handles and checks every SQL connection observed through native `exec` or `prepare` before reopening, and reuses the persisted Source without its callback. Tests compare original closure, call-bearing input, application, Match, ten role effects and readiness before and after.

`SqliteWriteWitness.test-support.ts` adds an optional regular-expression target selector so a transaction witness need not duplicate the future writer's precise whitespace. Existing exact-string behavior is preserved. One additional helper case specifies formatting-independent matching, unrelated-table exclusion and immunity to stateful regex cursors.

The connection observer is not constructor interception: a connection that never calls `exec` or `prepare` is outside its evidence. No all-constructor closure guarantee is claimed. The initial 23 cases do not yet prove the later duplicate/escaped alias, peer-write, complete line-score, or genuine physical/review matrix.

No test, compiler, catalog or Native runtime was executed. The intended missing-adapter RED has not been observed. Source review and `git diff --check` are the only validation at this checkpoint. All broader cases below remain requirements for the later implementation/gate; this initial test preparation does not claim the complete matrix.

## Result and recommended boundary

Core already supports explicit `base_hit`, `reached_on_error` and `fielders_choice` scorer evidence. Native `SqliteOfficialScoringStore` already persists that accepted evidence with its exact official application and one-per-closure/source constraints. What is absent is a same-connection actual-live admission owner binding the independent scorer Source to the original actual physical/official graph.

Add a post-closure Source/archive adapter and reuse the existing scoring writer. Do not add later scoring to the frozen actual closure proposal: doing so would alter its hash, workload/readiness references and historical `scoring: unsupported` result. A separate read-only description can join the original closure with the later scoring receipt. Missing or unsupported scoring never changes continuing-game activation, physical history, official Match state or workload.

This is the smallest adapter slice. It does not complete general scoring, create a scorer authority, infer a judgment, construct a final aggregate, or widen the Core categories.

## Authority and source map

All repository paths below are relative to the audited worktree.

- `docs/game-design/07-world-first-adjudication-contracts.md:517–553`: scoring consumes closed/adjudicated play plus preserved physical evidence; H/E are not derived from runs. D-10 at 805–809 permits gameplay with unsupported scoring. The closed-state rule at 269 forbids rewriting a closure for later statistical descriptions.
- `docs/project-status/2026-10-05-nonvisual-remaining-matrix.md:13`: remaining item 5 covers the original physical/official/scoring/workload connection while distinguishing it from general-play completion.
- `docs/superpowers/plans/2026-10-01-resumable-physical-play-closure.md`: existing-owner sequence, original evidence, contiguous line-score history, independent atomic owners, retry and reopen.
- `src/core/adjudication/OfficialScoring.ts:13–40,70–129,163–217`: independent `OfficialFairBallScoringEvidence`; validates rule profile, closure/effective ruling, record tick, original contact/fair events and batter survival. FC additionally requires a prior runner retired by the closed official state. Non-live walk/K and bounded caught-foul out are separate existing paths. Fair-ball OUT is not a supported scorer category.
- `src/host/SqliteOfficialScoringStore.ts:36–48,84–109,120–215,229–274`: existing scorer callback, durable evidence snapshot, original official request/receipt validation, one scoring row per `(match_id,closure_id)`, globally unique source event, immutable idempotent replay. Its `evidenceGuard` receives the writer's own SQLite connection. The store is not currently connected to actual-live closure ownership and does not archive an actual-live Source envelope.
- `src/host/world/ActualLivePlayClosureEvidenceFromSqlite.ts:22–34,125–146,155–195`: authenticates actual end/history, derives selected official ledger and exact application, classifies without scorer evidence, archives/hash-checks the immutable result. The original actual closure can remain `unsupported` permanently while a downstream record is added.
- `src/host/world/ActualPostPlayReviewClosureFromSqlite.ts:17–49`: closure selection requires the current review session revision/head/hash and original seed scope, with all windows closed; missing optional pin cannot bypass an enrolled review owner.
- `src/host/world/ActualPostPlayReviewNativeMetadata.ts:42–55`: queued/applied closure reserves the play against subsequent review writes. `ActualPostPlayReviewClosurePin.test.ts:141–148` already specifies historically-ready versus current pin staleness.
- `src/host/world/ActualLivePlayReadinessFromSqlite.ts:9–55` and `PhysicalPlateAppearanceActorEvidenceFromSqlite.ts:62–65`: actual gameplay readiness comes from closure and original actual-role effects, independent of supported scoring. `ActualLiveNextActorArtifact.test-support.ts:58,79` explicitly preserves unsupported scoring and null legacy scoring hash.
- `src/host/world/ActualLiveFinalScoringSource.ts:6–31`: accepted game aggregate, explicitly not a per-play judgment. `ActualLivePlayClosureEvidenceFromSqlite.ts:68–88` binds it to original seed adjudication/fixture and game-final application. Its Source has no effective ruling or review-head field; it must not be reused as the new per-play basis.
- `src/host/world/PhysicalPlayClosureEvidenceFromSqlite.ts:83–112,153–168`: existing line-score consumer replays `official_scoring_applications` for every prior contiguous official application. It credits H to batting team and E to fielding team. The new receipt can use this unchanged representation; absence of any earlier supported record remains explicit missing history, not zero H/E.
- `src/host/world/DomesticSeasonRuntime.ts:230–249`: World settlement consumes the already final actual closure and its accepted final aggregate, plus authenticated workload. A new per-play scorer record neither reapplies World effects nor replaces that aggregate.
- `src/host/world/SqliteOfficialPitchWorkloadStore.ts:204` and `ActualRoleWorkloadChargeGuard.ts`: legacy scored-play workload and actual-role workload have cross-owner duplicate-charge fencing. The new adapter must never invoke the legacy workload producer.

Repository searches for `OfficialFairBallScoringEvidence`, `readAcceptedOfficialScoringEvidence`, `official_scorer_judgment` and scorer owners found only the Core type, the generic scoring callback/store, consumers and tests. No existing durable actual-live per-play scorer admission owner was found at this base.

## Suggested Source and dependency contract

Suggested names, not implemented APIs:

`AcceptedActualLiveScoringSource` contains exactly:

- `sourceId`, `sourceVersion`, `gameId`, `scoringApplicationId`
- `closureReference: { sourceId, proposalHash }`
- `evidence: OfficialFairBallScoringEvidence`

`sourceId === evidence.sourceEventId`; use one accepted scorer-event identity rather than two aliases. `sourceKind` remains the existing `official_scorer_judgment` inside evidence. An independent authority supplies this Source through `readAcceptedScoringSource(sourceId)`; neither a caller-supplied result nor a `scorerId` string creates acceptance. No automatic authority, staff assignment, calibration or default judgment is introduced.

The adapter must derive the following on its own SQLite connection from `actualLivePlayClosureEvidenceFromSqlite(db).read(closureReference.sourceId)`:

1. The closure exists, is `OFFICIAL_APPLIED`, and has the exact durable original official application/receipt. A queued proposal alone is insufficient for scorer acceptance.
2. `hash(proposal) === closureReference.proposalHash`, with exact game, play, rule profile and source IDs. Preserve the proposal's physical end, whole history, original adjudication and optional review reference.
3. The supplied evidence closure ID equals the actual closure Source ID; `basisRulingId` equals the *closed selected ledger's* final ruling ID, not the original call or seed snapshot ID. The proposal hash binds the exact review revision/head even when later review activity happens to produce the same ruling ID.
4. Contact/fair sequence/ticks and batter identity come from the original stored application/timeline. Reuse the existing Core classifier; no inference from possession, safe-at-first, fielder speed, trajectory or aggregate H/E.
5. For an error, bind `chargedFielderId` to an original defensive participant in the authenticated closure actors. Core currently checks only a nonempty ID, so this is an actual-world identity check, not a new error-classification algorithm. For FC, require the existing prior-runner/ruling checks; do not synthesize a prior runner where the actual owner has none.
6. Store an owner-derived proposal with the exact application, original receipt, closure proposal hash, physical/history/adjudication/review references, accepted evidence and expected `PersistedOfficialScoring`. The reader rederives and compares this proposal; it never trusts caller physical snapshots or a replacement ledger.

Do not require the global Match head to remain at the just-closed play: later legitimate gameplay is permitted. Validate the original applied receipt and historical actual closure. Existing review reservation plus proposal/effective-ruling pins must already authenticate before Source insertion; scoring is not a remedy for stale review state.

## Transaction and recovery contract

Suggested files: `ActualLiveScoringSource.ts`, `ActualLiveScoringEvidenceFromSqlite.ts`, `SqliteActualLiveScoringStore.ts`; source/Native tests. No necessary Core classification or frozen closure/readiness schema change.

Use a small staging table with Source ID primary key; unique scorer application ID, official application ID and `(game_id,play_id)`; immutable source/proposal JSON and hashes. `QUEUED` and `SCORED` refer only to the downstream scoring workflow, not gameplay closure.

1. `enqueue(sourceId)` reads/detaches the independently accepted Source, obtains a read-transaction preflight, then uses `BEGIN IMMEDIATE` for same-connection dependency/identity reauthentication. Re-read accepted Source, compare exact original evidence and raw ownership rows, insert the reservation, then re-read Source/archive/dependencies after INSERT before commit. No accepted Source or unsupported/mismatching classification means zero writes.
2. Guard aliases through both SQL columns and raw JSON identity mirrors with existing ownership-metadata helpers. A corrupt cached scope must not hide another owner of the same Source, closure, application or play. Same exact Source is idempotent; a changed Source/version/evidence or competing Source cannot replace it.
3. `resume(sourceId)` supplies the exact queued evidence/application to `openSqliteOfficialScoringStore`. Reuse its existing durable table and classifier. Its writer-connection `evidenceGuard` authenticates the queued source and original closure on `retry`, and verifies the inserted scoring request/evidence/result against the expected proposal on `written`. Do not treat a source read on another connection as the write guard. Keep the Source reader separate from scoring-stage verification to avoid recursion.
4. Mark `SCORED` with CAS only after same-connection authentication of the exact existing scoring row. An interruption before scoring leaves an accepted queued source; after scoring but before checkpoint leaves one recoverable scoring row. Do not claim the Source and generic scoring writer's separate transactions are one transaction.
5. Read/retry after all connections close must use the persisted accepted Source, without requiring the external authority process. If a current authority is supplied and returns a different Source, reject the attempted resubmission; historical reads retain original acceptance. Later Match/workload progress must not invalidate the retained original effect.
6. Never update `actual_live_play_closures`, `applications`, `matches`, review journal/calls, physical tables, workload or World state. A read-only join may expose `{ originalClosure, scoringReceipt }`; original `proposal.scoring` and result bytes stay unchanged.

## Minimal test/fixture contract for the later execution gate

The first production slice can prove H/E admission for an already applied safe fair-ball actual closure. Keep the three existing Core categories; do not add fair-ball OUT, RBI, earned runs, sacrifice or extra-base classification.

Focused tests should use genuine disk/WAL SQLite, the real closure/scoring writers and real review journal where applicable, with explicitly labeled synthetic physical-reader fixtures. They prove Source/transaction boundaries, not original physical-chain acceptance.

1. Accepted base hit and reached-on-error fixtures produce one existing scoring row and the exact H/E record; original closure/application/call/physical/readiness bytes and ten workload effects remain unchanged.
2. Missing Source, unapplied closure, unsupported fair OUT, wrong game/play/closure/ruling/tick/event sequence, foreign batter/fielder and contradictory FC produce zero scorer rows and no closure mutation.
3. Review pin: stale revision/head with the same original seed (including outcome-neutral later scheduler revision), omitted enrolled pin, pending windows and outdated effective ruling all fail before scorer Source acceptance. A valid reviewed closure accepts exact-basis evidence; original call/physics stay unchanged.
4. Identical retry, competing Source for the same closure, reused source ID on another game, changed scorer/version/judgment and duplicate/escaped identity mirrors. Missing/deleted/replaced dependencies and coherent cached-row rewrites fail closed.
5. Real peer commit between preflight and `BEGIN IMMEDIATE`; callback mutation; writer-local AFTER INSERT dependency/source/scoring corruption. Require an INSERT witness, complete rollback and no partial receipt.
6. Interrupt Source insert, scoring insert and completion CAS separately. Close every connection; reopen without authority; resume to exactly one scorer record. Repeat after legitimate later Match/workload activity.
7. Existing `readAcceptedPlay` returns the original exact application plus new scorer result. The existing contiguous line-score path counts the persisted H once and charges E to the fielding side; missing earlier unsupported plays remain a missing-history result. Existing actual World settlement continues to use its explicit final aggregate and never reapplies workload.

The later unmocked gate must use a separate copy of a genuine original closed safe-fair artifact, then supply an explicit fixture scorer judgment and verify unchanged original physical/call/closure archives, exactly-once scoring, close-all/reopen and unchanged next-play readiness. If the available genuine artifact is an OUT (the current next-actor artifact has no surviving runner), its supported fair-ball scoring remains unavailable; do not relabel the artifact or add a category to make the test pass. Obtain a genuinely supported original artifact only under the separately coordinated runtime gate.

## Boundaries remaining after this slice

- General scorer judgment generation/assignment is still explicit input, not implemented automation.
- General OUT/sacrifice/RBI/earned-run classifications remain unsupported.
- Full game line-score derivation still needs complete supported history; late one-play evidence is not a complete aggregate.
- Existing actual final aggregate's review-basis provenance should be assessed separately before expanding its use. This slice avoids depending on that aggregate for per-play judgment.
- No runtime/compiler/catalog/pilot, test run, artifact DB modification/publication, CI, UI, workflow, merge or deployment occurred in this preparation.
