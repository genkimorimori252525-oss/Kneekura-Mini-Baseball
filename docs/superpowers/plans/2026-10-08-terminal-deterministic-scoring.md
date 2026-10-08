# Terminal deterministic scoring contract

Prepared from acknowledgement commit `2a0b33242d8a094f595e516f4ce83d23d4c06bd0`, src tree `801331b24872f3d9916da17d9a831bd3dba6d2e9`. The coordinator is still qualifying acknowledgement Native fault/wire cases. This is static preparation, not a prerequisite qualification claim or permission to run a gate.

## Authority and boundary

This implements the next bounded slice of `2026-10-05-owned-batting-intent-and-same-pa-foul-resume.md`, `2026-10-07-terminal-pending-post-play.md` and `2026-10-08-terminal-official-acknowledgement.md`, under `AGENTS.md`, runtime §§9.5–10.4 and adjudication §§9–10. The coordinator's source-only `terminal-postplay-next-contract-proposal.md` supplies the selected scope. No UI/design decision or new baseball/calibration value is needed.

The only new durable effect is one row in the existing `official_scoring_applications` owner for the genuinely acknowledged terminal strikeout. This operation does not change terminal stage/result/proposal, P/C/E/journal, Match/application mirrors, workload, reset, finalization, or next-play authority. Both admission routes continue rejecting this terminal pending origin. Existing optional fair-live H/E classification does not become a new activation prerequisite.

No successful production behavior may be written until (1) the coordinator confirms final acknowledgement qualification and releases the exact runtime lane and (2) S01 observes the intended missing-adapter RED after current real original-evidence authentication. No compiler, module loading, tests, SQLite opens, runtime, producer regeneration, CI, publication or private database upload is part of static preparation. Parent owns runtime admission and publication. The existing semantic/Proxy repair remains held.

## Exact public interface and wire

`src/host/world/SqliteActualFoulTerminalScoringStore.ts` exports `openSqliteActualFoulTerminalScoringStore(path)` returning only:

```
apply(terminalSourceId: string): PersistedOfficialScoring
read(terminalSourceId: string): PersistedOfficialScoring | null
close(): void
```

No authority callback, scoring judgment, caller receipt, proposal, timing, setup, origin assertion or optional original-evidence proof is accepted. `apply` requires an existing authenticated `OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY` source. `read` returns null only when no scoring row/claim exists; an existing non-acknowledged terminal stage is rejected, and surviving raw scoring claims without the original terminal owner are corruption, never absence. Invalid IDs and use after close reject; close is idempotent.

For a freshly authenticated acknowledged terminal `a`, set `p = a.proposal`, `request = foulTerminalPendingInput(p)`. The exact scoring application ID is the UTF-8 JSON array string `JSON.stringify(['actual_foul_terminal_scoring_v1', p.source.sourceId])`. This is a separate versioned ID domain, not an application/closure ID. `sourceEventId` remains exactly `official-non-live:${p.source.applicationId}`.

The one canonical row retains the existing seven columns and encodings:

```
request_json = json({ input: { scoringApplicationId, officialApplication: request }, evidence: null })
result_json = json({ scoringApplicationId, matchId: p.gameId,
  officialApplicationId: p.source.applicationId, closureId: p.source.sourceId,
  sourceEventId: 'official-non-live:' + p.source.applicationId, record })
```

Here `json` is existing sorted canonical JSON and `record` is the supported result of `classifyClosedPlayForOfficialScoring({kind:'non_live', match:request.match, timeline:request.timeline, adjudication:request.adjudication, context:request.context})`. Require the deterministic strikeout class and zero H/E. Preserve the Core-derived run delta; never replace it with an assumed zero. The official request hash is `hash(request)` without the legacy `{kind:'game_final',request}` wrapper, whether `game` is null or an accepted bound policy. Validate the whole `deriveOfficialPendingNonLiveResult` receipt/marker and current terminal/Match/application mirrors, not a few receipt fields.

The original ledger's sole `OnFieldCallRecorded.call.callId` is the final ruling ID in the closed application ledger. Existing source authentication binds it to `callSource.sourceId`; the enclosing ledger event ID is instead `callSource.sourceId + ':call'`. `callIntent.sourceId` identifies the accepted intent, not the call. Neither the event ID nor the correct-rule oracle's ruling ID may replace the call ID. `proposal.scoring` was frozen from that oracle before application-ledger closure; its differing `basisRulingId` remains byte-identical history. The new row must classify the application ledger afresh and preserve the original raw physical P as `batted_ball_pending`; terminal C's composed timeline does not replace P.

## One connection and one canonical scoring writer

Extract/reuse the existing classification, canonical row construction, decode, duplicate/retry comparison and real INSERT from `SqliteOfficialScoringStore.ts` as one connection-bound scoring writer. The legacy opener still owns its usual connection/setup/transaction and retains exactly its public types, return objects, serialization and accepted-play union. The connection-bound owner performs no DDL and no independent transaction. Its terminal operation accepts a terminal Source ID and internally installs mandatory `ActualFoulTerminalScoringEvidenceFromSqlite` authentication on that exact writer connection. A caller-supplied pending request or optional evidence guard cannot substitute for this proof.

Use an explicitly private internal request union for legacy and terminal pending requests. Keep public `PersistOfficialScoringInput`, `AcceptedScoredOfficialPlay` and the legacy scoring store API unchanged. The generic legacy apply, readApplication and readAcceptedPlay reject a terminal-pending mode at runtime before generic hashing/derivation. They must never decode the terminal row into the old accepted-play shape. Existing optional legacy `SqliteEvidenceGuard` remains legacy-only. The terminal path invokes its own mandatory before/after evidence proof through the same connection seam.

`ActualFoulTerminalScoringEvidenceFromSqlite.ts` derives terminal request/expected row, validates all raw claims and captures immutable dependencies. It does not call a scoring store or recurse from terminal ancestry into scoring. Reuse `foulTerminalApplicationEvidenceFromSqlite(db).read(sourceId)` and `foulTerminalApplicationPin`; supplement raw schema and rowid pins, participant/policy dependencies not already fully pinned, and scoring claim discovery. Mandatory proof runs after transaction acquisition, before the real INSERT and after the statement plus its triggers. An exact retry and read rederive all dependencies and canonical row bytes.

The public terminal opener requires an existing canonical absolute regular file, exact user_version 3, exact acknowledgement-capable terminal CHECK, required official layout, and existing exact canonical scoring table columns/PK/UNIQUE/FK. Validate before writer PRAGMAs; reject :memory:, nonexistent/symlink paths, missing table, altered constraints, temp shadowing and replacement views. It creates or migrates nothing. Capture installed triggers in the operation's exact schema pin; real trigger-induced writes must reach the post-INSERT evidence/accounting checks and roll back, rather than receiving false fault-test credit from an opener rejection. Missing canonical scoring storage may be installed only by the controller on an exclusive new copy after authenticating the pinned acknowledgement artifact and recording a table/schema delta. The production opener never accepts a caller quiescence Boolean.

Transactions follow the qualified runner's owned BEGIN IMMEDIATE/read BEGIN, unique savepoint, query_only proof, preserved query_only state, exact schema counters, and retirement after rollback/restoration/transaction-identity failure. No pre-acquisition cached proof qualifies the write. First apply makes exactly one total change and one canonical INSERT; read/retry/reopen make zero. After INSERT reauthenticate the original source and dependencies, re-read and fully compare the row, assert no competing claims, exact rowid/census delta, identical main/temp/user schema, and unchanged immutable pins. Extra trigger writes, including byte-neutral update-then-restore writes, fail exact total-change accounting and roll back.

## Raw ownership and explicit legacy fences

Raw discovery precedes parsing and compares every canonical row claim, including malformed/cached-foreign rows. Scan scalar columns and request/result mirrors for scoring ID, terminal origin source, original application ID, closure ID, canonical non-live event ID, and original `(matchId, playId)` scope. Include request non-live `timeline.playId`, Match/adjudication play IDs and result record scope. Preserve duplicate/escaped keys and nested-array ancestors using existing metadata walkers. Decode the versioned scoring ID's embedded Source ID as rejection-only linkage, including when its outer cached IDs are foreign. The event prefix links only its explicit original application suffix. Traverse linked aliases transitively. A row with an unrelated original play in the same game is not a competitor. The exact expected selected row is the only allowed terminal claim after apply; prior to apply there must be none. A second raw-only claim always rejects even if UNIQUE keys differ.

The rejection-only helper is `foulTerminalScoringClaimRows(db, {terminalSourceId, applicationId?, matchId?, playId?})` in `ActualFoulTerminalScoringEvidenceFromSqlite.ts`. An absent original owner can still be checked using terminal Source ID alone. Optional scope is derived only from authenticated original evidence in the production path. It returns deterministically sorted raw rows, never a valid scoring receipt. Use `originalFoulMetadataValues`/`originalFoulReferenceIds` to retain owner/source pairing while flattening unexpected array ancestors. Canonical ID decoding is linkage only; malformed/noncanonical JSON cannot become accepted wire by matching an ID.

Add explicit rejection of `mode:'non_live_pending_post_play_v1'` at these old consumers before their current discriminators/fallbacks:

- `SqliteOfficialScoringStore`: apply and both row-reading APIs.
- `SqliteOfficialPitchWorkloadStore.project`: immediately after reading the scored application, before participation, policy/physical derivation or durable activity writes.
- `PhysicalPlayClosureEvidenceFromSqlite.readPhysicalClosureScoringHistory`: before the `game` discriminator or contiguous-history fold; this slice does not claim completed terminal history support.
- `PhysicalPlateAppearanceActorEvidenceFromSqlite` legacy scoring/activation fallback: before its generic immediate-activation derivation. Existing terminal raw guards remain authoritative and unchanged.

Do not widen old types, strip `mode`/`game`/origin to force a legacy path, weaken raw P=C checks, invent a pitcher-only terminal charge, or allow pending scoring to satisfy readiness.

## Test-first execution and evidence

1. Static: write this contract, S01 and rejection/fault test specifications; obtain independent source/contract review. Keep runtime held. Import the coordinator's final retained acknowledgement helper only after its commit is supplied; never import an acceptance test or call apply/ack to manufacture a prerequisite.
2. After explicit release: use only the approved pinned acknowledged artifact/control and copy-only lineage verifier. On a new controlled copy, authenticate P/C/E/journal/application/acknowledgement with current production readers; independently check original assigned-call/oracle distinction, pending mirrors and original P. Explicitly prepare canonical scoring storage if absent, conserving every existing row/schema and recording the exact delta. S01 then reaches `GENUINE_ACKNOWLEDGED_TERMINAL_SCORING_API_MISSING`. Missing imports, controller/fixture errors or source failures are not RED credit.
3. Only after witnessed S01 RED: minimally implement the shared writer extraction, terminal owner and explicit old-consumer rejections. Preserve the RED test unchanged for GREEN. Run focused compiler and selected legacy writer/actual-live scoring parity under separately admitted controls.
4. S01 GREEN: witness actual scoring INSERT on the writer connection inside its owned transaction, verify assigned `basisRulingId`, differing frozen oracle projection, exact request/result/row accounting, unchanged raw P/C/E/journal/terminal/application/Match/workload/schema, exact read/apply/reopen retry, and both next-admission guards still closed. Verify legacy scoring accepted-play APIs reject the new row.
5. Separate bounded Native cases: AFTER INSERT mutation of original P, C, E, journal, acknowledgement, application and Match; competing raw-only scoring claim; mutated/deleted newly inserted scoring row; unrelated and byte-neutral writes. Witness the actual statement/trigger effect and require full rollback. Add real peer commit before BEGIN IMMEDIATE and require post-acquisition rejection. No fault loop silently regenerates the fixture.
6. Separate integrity cases: missing/damaged P/C/E/journal/terminal/application/Match/acknowledgement; canonical request/result corruption; absent selected row with surviving identity/scope alias; stage downgrade; raw duplicate/escaped/array aliases; invalid storage and side-effect-free opener refusal. Metadata-only fixtures prove parsing/discovery, not genuine physical provenance. A second genuine terminal origin remains missing until separately produced and qualified.
7. Independent final review and bounded verification record. Distinguish passed/failed/never-run; neither one positive nor synthetic aliases prove the unrun Native fault cases. Parent integrates and publishes only reviewed locally committed source.

## Static preparation status

- Static contract and 30 test cases are authored: S01 positive/RED, fourteen S02 fault variants, S03 peer freshness, S04 transaction replacement, and thirteen M01–M05 metadata cases. No production source has been changed.
- The first independent review corrected assigned-call wording and moved the S01 INSERT witness before opener construction. S02 now includes a raw-only competitor, unrelated write and real mutate/restore pair; S03 checks the full census against exactly its peer revision delta. Metadata review is separately recorded with the final review artifact.
- No compiler, imports, tests, database opens or runtime have run in this scratch clone.
- The retained acknowledgement helper is a deliberate source dependency on the coordinator's final prerequisite commit; until that lands the current scratch is not compiler-ready. Missing-helper errors cannot count as scoring RED.
- Missing/damaged Native prerequisite cases, mode/hash/full-receipt corruption, storage-refusal tests, downstream workload/history/actor rejection and query_only/rollback-restoration failures remain to be authored and run. S01 covers the three legacy scoring entry points only. The metadata fixtures are rejection-only corruption examples and never a second genuine terminal origin.
- Acknowledgement is a required prerequisite and is not yet fully qualified according to the coordinator's latest instruction.
- Workload, completion/reset, history replay and next activation remain separate later slices with their own accepted inputs and test-first qualification.
