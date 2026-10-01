# Native Person population batching Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Fresh read-only review is required before publication.

**Goal:** Materialize the full accepted global Player population into unique durable Person links and deterministic hidden genesis priors without repeatedly validating the entire roster per Player.

**Architecture:** Extend the two existing Native owners with atomic batch methods. Each transaction validates and indexes each actual Career roster once, then discards that local index. Accepted Sources are independently detached before writes; every link and hidden prior retains its existing identity, canonical bytes, generation policy and historical replay rules. Ordinary reads and later batches always reload and validate current durable evidence.

**Tech Stack:** Existing TypeScript, Node SQLite and Vitest; no new dependencies or schema migration.

**Spec:** Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, canonical documents32/50/51/53. Document32's legacy DRAFT filename is explicitly approved/frozen; one global Person per Player. Document53 requires Person-specific hidden trajectory/catalyst/genesis data and separate versioned Career RNG. Existing accepted policies remain authoritative.

## Global constraints

- User authorizes all confirmed nonvisual implementation, commit/push and stacked PRs; no design/Presentation connection or merge.
- No new production roster quota, talent formula, birth/intake algorithm, rating inference, policy calibration default or public hidden-prior projection.
- Existing 100k ordinary inert-data and scoped full-roster budgets remain unchanged. Detach each accepted Source independently; do not serialize a whole population as one ordinary DTO.
- Existing exact accepted Source semantics and single-record APIs remain compatible. Batch retries preserve original identity and hidden seeds.
- No process-wide validation cache; within-transaction indexes cannot authorize later calls.

## Review focus

- Invalid/sparse/accessor/duplicate Source IDs must fail before acceptance.
- Late invalid Source, duplicate Player/Person or SQLite write failure must roll back the whole corresponding batch.
- Cross-connection Source readers must finish before writes; callback mutation cannot alter detached earlier Sources.
- Old accepted links remain supported by a later roster, but fresh acceptance requires the exact current revision.
- Corrupted roster/link/policy/prior must be detected on later calls and original retries; no stale cache or reseeding.

### Task 1: Atomic accepted Person links and hidden priors

**Files:** Modify `src/host/world/SqlitePlayerPersonLinkStore.ts`, `src/host/world/SqlitePersonGenesisStore.ts`; create `src/host/world/SqlitePersonPopulationBatch.test.ts`.

**Interfaces:** `acceptBatch(sourceIds: readonly string[]): readonly DurablePlayerPersonLink[]`; `materializeBatch(sourceIds: readonly string[]): readonly DurablePersonPriors[]`. Preserve input order, reject empty/duplicate IDs, detach accepted facts before the first write. Existing single APIs delegate to the same transaction logic. Batch indexes validate actual shared `world_roster_heads` once per Career and use a Player-ID Set. Hidden priors use existing `generatePlayerPersonPriors` and pinned seed/policy.

- [x] Write and run RED for missing batch APIs on actual Native stores.
- [x] Implement batch methods and transaction-local roster indexes using the existing schema and validation.
- [x] Add/run actual late-invalid/write-failure rollback, changed-evidence/reopen, Source detachment and invalid-input tests. Additional RED pinned evidence changed by later writes inside the transaction and a reviewed valid Source rewrite at INSERT; both were fixed before final gates.
- [x] Run existing Person links/genesis/intake/workload/development tests and typecheck: final 10 files /26 tests passed in 27.82s; typecheck/catalog compilation passed.

### Task 2: Full catalog population gate and publication

**Files:** Modify `src/host/world/WorldRosterCapacity.test.ts`; create `docs/project-status/2026-10-01-native-person-population.md` and this saved plan.

- [x] Extend the existing actual 234-Club / 11,700-Player Native gate to accept all independently supplied fixture Person Sources and materialize every hidden prior. The 50-Player/10-active profile remains verification-only.
- [x] Verify unique Player/Person mappings, deterministic pinned generation, later intake/roster history, reopened original population and isolated hidden data using real stores.
- [x] Request one fresh read-only review. One Important issue was reproduced/fixed; reviewer confirmed no remaining findings. Independent 3 files /12 tests passed in 0.994s.
- [x] Run relevant gates and whole `npm run verify`: 530 files /3,147 tests passed in 626.62s. Exact-SHA P0 follows publication.
- [ ] Commit/push stacked on the verified domestic season advance PR; attempt attachment once and dispatch exact-SHA P0.
- [ ] Continue actual nonvisual Career/runtime gaps; this bounded population slice alone does not complete the goal.
