# World roster capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Persist and consume a complete multi-Club global roster without treating a per-document inert-input budget as a game roster quota.

**Architecture:** Keep the existing single Career roster, public DTOs, canonical JSON ordering, CAS rules and accepted Source checks. Measure a complete 234-Club fixture first. If it exceeds the current 100,000-node transport budget, give validated roster subtrees their own bounded transport traversal while retaining the original budget for ordinary evidence and all inert-data checks.

**Tech Stack:** TypeScript, Node SQLite, Vitest; no new dependency.

**Spec:** Approved foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, `docs/game-design/32-roster-development-architecture-DRAFT.md`; current `RosterTypes.ts`/`RosterState.ts` and Native global roster/intake/Person/national snapshot owners. Document 32 requires the same administrative model across all Clubs and pins numeric roster rules through explicit profiles.

## Global Constraints

- No design/UI integration, merge, inferred geography or real-player ability imports.
- The 50 Players per Club and 10 active Players per Club below are explicit scale-test inputs, not production League rules.
- Keep a single global roster and all existing source, revision, identity and legal-profile checks.
- Retain canonical serialized content/hash compatibility for existing small DTOs.
- Do not raise `OfficialWindowPolicy.cloneInert` globally or remove sparse-array/accessor/symbol/cycle/prototype checks.

## Review Focus

- A complete world exceeds a generic input budget: measure nodes and exercise actual Native persistence rather than a standalone serializer only.
- Fake roster-shaped input must not bypass validation or authorize a Player/Person.
- Sparse arrays, accessors, cycles, nonfinite numbers and unsupported prototypes remain rejected without executing getters.
- Reopen/CAS must preserve all other Clubs when one new Player enters the global roster.
- National snapshots pin the old full roster after a newer accepted intake; current-head reads must not rewrite historical snapshots.

### Task 1: Reproduce Native world capacity

**Files:** Create `src/host/world/WorldRosterCapacity.test.ts`.

**Interfaces:** Consume the actual Native catalog and atomic Career Club creation from PR228, `createRosterState`, Native Manager roster, Player intake/link and National roster snapshot owners.

- [x] Create the actual 234 Clubs, with explicit synthetic population input containing 50 Players per Club, 21 pinned League profiles, FIRST_TEAM/RESERVE units and 10 ACTIVE Players per Club.
- [x] Assert 11,700 Players and measure the fixture node count; initialize/read the first and last Clubs through the shared Native global roster owner. Capture a National snapshot; accept one actual independently supplied intake fact; assert revision1/11,701 Players and unchanged existing Club assignments.
- [x] Reopen readers and verify the old National snapshot and new global head independently. Run `npx vitest run src/host/world/WorldRosterCapacity.test.ts`; record the first actual failure before selecting changes.

### Task 2: Bounded roster evidence transport, if required by Task 1

**Files:** Create `src/host/world/RosterEvidenceJson.ts` and `.test.ts`; modify the specific measured consumers in `SqliteManagerRosterDecisionStore.ts`, `SqlitePlayerIntakeStore.ts`, `SqlitePlayerPersonLinkStore.ts`, `SqlitePersonGenesisStore.ts`, `SqliteNationalRosterSnapshotStore.ts`, and `SqliteFreeAgentContractStore.ts` as their full-roster reads require it.

**Interfaces:** `canonicalRosterEvidenceJson(value: unknown): string`, `cloneRosterEvidence<T>(value: T): T`. Ordinary evidence keeps 100,000 nodes/depth64. Only complete inert Core-validated `RosterState` objects use the additional bounded budget. Measured RED: full roster 212,668 nodes, Club creation 51,020 nodes; Manager roster persistence throws `roster execution evidence exceeds size limit`. The validated roster transport budget is 1,000,000 nodes, with a 4,000,000-node composite cap; neither is a League roster limit.

- [x] Add RED tests comparing exact legacy canonical JSON, rejecting getter/sparse/cyclic/nonfinite/fake-roster inputs and preserving the generic large non-roster rejection.
- [x] Implement inert descriptor traversal before Core schema checks. Keep plain objects, dense arrays, sorted object keys and all source fields; no dropping data to make a snapshot smaller.
- [x] Replace only roster-bearing serialization/cloning paths shown to fail. Keep small policy/intake/request validation on the existing guard.
- [x] Run focused codec/capacity and touched-owner gates plus `npx tsc --noEmit`. If another consumer fails, reproduce it in Task1 before modifying it.

### Task 3: Full-world source boundaries

**Files:** Extend `WorldRosterCapacity.test.ts`; modify a national callup evidence consumer only after a full-world gate demonstrates its failure.

- [x] Bind one real existing global Player to an accepted Native Person link at the full roster revision and exercise the existing Person/source reader; preserve explicit test policy provenance.
- [x] Verify old snapshot pinning and corrupt-source rejection at full scale. Exercise roster-bearing National callup serialization if its existing full snapshot dependency remains over budget.
- [x] Add actual Manager decision or contract advancement at full scale using existing action/profile fixtures when the corresponding consumer is changed; assert unrelated Clubs remain unchanged.

### Task 4: Review and publish

- [x] One fresh read-only reviewer; fix concrete Important findings with RED/GREEN, without a rereview loop.
- [x] Run `npm run verify` to a scratch log and confirm catalog/typecheck/full suite success; record actual counts and measured population limits in a dated project-status document.
- [x] Explicitly stage intended source/test/plan/status files, check cached diff, commit, push and create a stacked PR based on PR228. Attempt thread attachment once, dispatch P0 and record the exact SHA/run. PR229: `a2547fbd6abd0aaf541d16e2ed14af333803226c`, P0 `36803196625`; attachment rejected by the 100-identity cap.
- [x] Continue the approved overall nonvisual goal; no partial final response.
