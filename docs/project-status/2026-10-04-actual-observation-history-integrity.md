# Actual observation history ownership integrity

This narrow repair applies to the inherited public `SqliteActualFieldObservationStore` on the continuation base `7b91ed48620696bb113d24b0ff2490a62dd839b9`. It does not change observation sampling, physical outcomes, defensive choices, authentication, or the archive schema.

## Confirmed gap

An independently reproduced SQLite corruption copied an accepted observation to a foreign indexed pitch/Player and Source/snapshot-Source scope while leaving its original pitch/Player in the copied history. The public original-ID read and immutable retry previously returned the original receipt without inspecting that hidden history owner. Additional direct-owner tests reproduce moved Source-ID mirrors and continuation writes past an ancestor with a foreign duplicate ID mirror.

These are deliberate own-database mutation tests. They do not establish that normal public acceptance can create the corrupted rows or make a broader security/authenticity claim.

## Repaired ownership boundary

- Source-ID discovery considers the primary index, Source, snapshot Source, and **last** history entry. Earlier entries remain ancestors, so legitimate later Sources are not mistaken for duplicate owners
- Pitch/Player discovery additionally considers every object identity in valid snapshot history, including earlier entries when the last entry has moved away
- Every row in the relevant indexed chain must have unique own-Source identity across the archive, including when accepting a fresh continuation
- For valid JSON, only typed indexed identity/lineage fields are projected: Source ID, physical pitch, Player, base field, execution, observation model and predecessor. Snapshot revision, array length and each history entry must match the indexed prefix
- Nullable execution/predecessor metadata must be explicit JSON null, not a missing or differently typed field
- Duplicate ownership/lineage keys and relevant `source`/`history`/`revision` containers are rejected. Discovery enumerates **every** decoded occurrence first, so a conflicting original identity in a later duplicate cannot remain hidden under foreign indexed ownership. Duplicate keys inside future view/receipt payloads remain outside this metadata contract

All of these checks run through the existing own-connection before/inside/after-insertion gates. A trigger-created hidden owner rolls back with the pending row/head; a corrupt row committed by a WAL peer before `BEGIN` remains that peer's committed change and blocks the new write.

The shared, read-only SQL helpers in `SqliteOwnershipMetadata.ts` enumerate configured object/array paths and project typed scalar metadata only. They do not impose completeness checks on unrelated rows or reconstruct domain payloads. `last` array traversal is per discovered array, preserving the distinction between an owner and its ancestors. Structured metadata values are represented by type without bringing their nested payload into JavaScript.

## Historical replay and byte compatibility

Future view/attention and perception receipt payloads are not deserialized or executed by the metadata checks. Invalid future JSON stays outside an older replay bound; available valid JSON identity metadata is still checked. Current reads and fresh writes retain full Source/dependency/snapshot validation. Existing stale-physical/actor checks remain in place.

No Source or receipt format, table definition, migration, hash format or sampler behavior changed. A separate executable bundled from the original owner (`a1fc139222e6555f2e90b8f013307911a7720d1bb74c944487f00120ad0cfe3f`) created a two-Source archive. The repaired owner read and retried both receipts unchanged; complete observation rows, heads, schema and physical field rows remained byte-identical.

## Verification

Direct-owner RED evidence: 17 expected failures and two passing historical compatibility controls on the original owner. A second RED gate exposed all three foreign ancestor-ID alias variants still permitting a fresh continuation after the first repair; the chain-level identity check closes those cases.

Independent review then found SQLite-first/JSON-last duplicate-key ambiguity. New REDs independently reproduced six future metadata/container ambiguities and ten hidden later-duplicate scope-only/ID-only variants. A duplicate-domain-payload control remained readable. The duplicate-preserving helpers and selected-row metadata checks address this separate issue.

The pre-duplicate-fix breadth run passed 10 files / 45 tests; that earlier result is **not** the final-source gate. Final repaired-source gate:

- Four focused files / **68 tests passed** in 183.09 seconds: the shared metadata helper, 40 direct observation-integrity cases, inherited observation-store regressions and inherited observation WAL regressions
- `npm run typecheck` passed, including the standard catalog generation check
- All tracked/new `src` file hashes matched before and after the final targeted run; `git diff --check` passed
- Independent review reran both original duplicate-key bypasses and verified they now reject. It also rebuilt the archive compatibility probe against the final owner and confirmed unchanged old receipts/rows/heads/schema/physical field rows
- Shared-helper dependency is commit `63dd60c4b847134917ae13eda6636edddd1bd978`, with 21 focused helper tests and an independent no-blocker review

The final checks used Node 26, one Vitest worker and local SQLite, not a full-suite or CI result. A later integrated gate belongs to its own fixed Source. No home/self-hosted CI, workflow, configuration or lock-file changes are part of this repair.
