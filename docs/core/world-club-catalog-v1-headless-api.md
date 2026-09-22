# World Club Catalog v1 — Headless API

Source authority: approved doc21/26–30 and successor doc33 at `782f6b8ef2406839de5678b00040001111cd8f77`. Club state ownership stays in `club-world-v1-headless-api.md`. This module has no UI, rendering, filesystem, networking or player ability dependency at runtime.

## What exists

The fixed dataset contains 234 clubs, 21 leagues and 1170 numeric five-axis targets, plus 148 directed relation rows. The existing RivalryLifecycle adapter interprets these as 141 historical edges and 7 competitive-threat signals; it also owns TITLE_RIVAL normalization and historical floors. No automatic reverse edge is inserted and famous-club targeting is not made a permanent memory.

Names, home-identity labels, initial economic bands and all numeric targets are imported from the approved source tables. Their provenance includes exact Git blob IDs and line locations. These are approved GAME SEEDS, not a newly verified ranking of real financial or sporting strength. Unknown precise money, geographical IDs, persons and actual stadium geometry are NOT inferred from names/bands.

## Build boundary

`data/world-club-catalog-v1/sources` contains exact frozen source blobs, protected from newline conversion by `.gitattributes`. `identity-registry.json` is the persistent mapping of opaque club/origin/league IDs. They are assigned once, not recomputed from current ordering or display names. Future datasets preserve existing IDs unless an explicit lineage/migration design says otherwise.

`node tools/catalog/compile-catalog.mjs` verifies source hashes, resolves identities and generates the ignored `src/core/world/catalog/GeneratedClubCatalog.ts`. Both `npm run typecheck` and standalone `npm test` generate it through their npm pre-hooks; `npm run verify` continues to run both. This adds no dependencies or lockfile changes. Bundlers consume generated literals; browser/runtime code does not parse Markdown or load files. A direct TypeScript invocation that bypasses npm hooks must run the compiler first. `node tools/catalog/compile-catalog.mjs --check` checks that the generated output still matches all inputs.

Do not edit the generated file. Catalog/version changes are source-data maintenance, not runtime operations. A host accepting an external/custom catalog must authenticate and freeze its catalog/version mapping; shape validation alone cannot prove that a claim of a particular version is authentic.

## Public operations

Import from `src/core/world/catalog/index`.

| Operation | Input | Output |
|---|---|---|
| `getDefaultClubCatalog()` | none | deeply immutable default ClubCatalog |
| `createClubCatalog(input)` | unknown serialized/plain catalog | `ClubResult<ClubCatalog>` |
| `findCatalogClub(catalog, query)` | `{ name, leagueId: string or null }` | `ClubResult<CatalogLookup>` |
| `createCareerClubs(catalog, request)` | complete `CareerClubCreation` | `ClubResult<CareerClubBundle>` |

`ClubResult<T>` is either `{ok:true,value:T}` or `{ok:false,reason:{code,path?}}`. These calls are synchronous, side-effect-free and produce detached frozen successful outputs. Rejections contain no partial world bundle. Invalid nested records/arrays are rejected without evaluating getters; callers should supply inert deserialized data, not proxies.

Lookup uses NFC Unicode normalization, outer whitespace trimming and case folding. Only full names and explicitly supplied aliases match. It does not strip accents, invent translations, fuzzy-match spelling or treat a name as an ID. Ambiguous names return `AMBIGUOUS` with all matching IDs; callers can supply an exact league ID. Unknown names return `NOT_FOUND` rather than choosing a first row.

## New-career input

`CareerClubCreation` contains:

- `context`: phase (`CREATION` required), careerId, effectiveDay and existingClubIds (must be empty).
- `season`: safe nonnegative integer shared by the bundle.
- `clubs`: exactly one `CareerClubSetup` for EVERY club in the supplied catalog.

Each setup supplies `clubId`, explicit `identityLinks` (foundingIdentityRef/originCountryId/historicalHomeCityId) and the existing `ClubCreationInput.initial` contract: brand, current home-city/owner/governance, physical stadium reference/capacity, actual money/debt/structural-revenue capacity, finance-normalization version, approved season plan and references to external players/persons/standings.

The brand must match the initial catalog name; later rename uses ClubLifecycle. The season and financial-profile league must match. Within a league, all clubs receive the same financial profile for this season; conflicting content under a profile/version ID is rejected. Rivalry/threat references in the incoming setups must be empty; the assembler installs exactly its generated directed references. Other person/player references are retained, not copied into a new state owner.

A RUNNING context, existing clubs, missing/extra/duplicate setup, invalid physical/money data, conflicting rules or unknown club causes whole-request rejection. This is an INITIALIZATION PROPOSAL, not a database commit or a declaration that the entire career is playable.

## New-career output and host transaction

The bundle contains immutable ClubWorldState records produced by `createClubFromSeed`, the existing rivalry sparse graph, a historical-edge reference directory, separate competitiveThreats, and pinned source/transform provenance. All initial directed seed intensities are preserved by the existing rivalry transform. Relation/memory IDs are career-scoped tuple strings; no delimiter ambiguity or inferred mutual relationship is added.

Typical usage:

```ts
import { getDefaultClubCatalog, createCareerClubs } from './src/core/world/catalog';
import type { CareerClubCreation } from './src/core/world/catalog';

// Supplied by authoritative setup owners; not invented money or geometry.
function proposeInitialClubs(request: CareerClubCreation) {
  return createCareerClubs(getDefaultClubCatalog(), request);
}
```

The host must independently confirm referenced persons/players/places/geometry/profile IDs exist and have the requested meaning. It must atomically verify the career is still empty and persist the ENTIRE club/relation bundle together. It must not commit individual clubs during a loop, reuse a successful proposal after the creation transaction lost a race, or feed a new catalog into an existing save. The phase flag is a caller assertion, not authentication or a persistence lock.

Preserve immutable provenance/version registries and use the existing owners for save/restore/migrations. This module deliberately provides no `reseedRunningCareer` operation. New datasets affect new careers only. The synthetic test financial/geometry setups are NOT a production default dataset.

## Out of scope

Full country/city/venue registry construction; calibrated monetary initial setups for every club; initial players/persons and assignments; contract authorization; automatic income/expense generation; financial-rule enforcement; matches/calendar/standings; manager AI; psychology/traits; current public rank computation; live save-service integration; UI. The independent completed swing stream is neither replaced nor merged here.
