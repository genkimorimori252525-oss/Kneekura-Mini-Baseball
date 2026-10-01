# Official physical pitch workload Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; request one fresh read-only review before publication.

**Goal:** Generate accepted MATCH workload from actual durable official physical pitch events and the actual pitcher actor, then apply it through the existing global Player workload owner.

**Architecture:** Expose read-only replay-validated accepted play evidence from the existing Native scoring owner and infer the actual pitcher from the Native activation/closure actor chain using the existing participation verifier. A separate durable Source producer archives an independently accepted, versioned per-physical-pitch effort calibration and immutable application references. It reads no caller fatigue, pitcher identity, day, pitch count or claimed result. Existing workload storage remains the state owner; source acceptance and workload application are independently replayable stages.

**Tech Stack:** Existing TypeScript, Core canonical pitch timeline, Node SQLite and Vitest. No new dependencies or migrations.

**Spec:** Current foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, frozen14/32/53: fatigue follows actual activity/recovery and affects later execution; development consumes actual effort/health/fatigue. Existing approved Native official scoring/participation and workload contracts remain authoritative. This slice supplies actual pitch activity; physical fatigue consumers and other activity kinds remain later dependencies.

## Global constraints

- User-authorized confirmed nonvisual implementation; no Presentation/design, obsolete plan or merge.
- Mere participation never generates workload. Only physical TakenPitchPlateCrossed, SwingCompletedWithoutContact and BatBallContact evidence qualifies. Bare PitchAdjudicated fixtures are insufficient.
- Effort calibration is an independently accepted explicit versioned policy, with no hidden production default. No game outcome, win/loss, League/Nation label, schedule density or scoring classification changes effort for the same physical action count.
- Keep one global Player fatigue history and immutable original activity; no National return or calendar reset, replay duplicate charge or hidden prior rewrite.
- Replay reads validate actual Native scoring/official application, actor binding and frozen policy without requiring the policy process. Existing ordinary evidence budgets remain unchanged.

## Review focus

- Missing/nonphysical/mixed fabricated pitch evidence must not authorize activity.
- Wrong activation/game/closure, non-pitcher actor or mismatched scope must fail before Source persistence.
- Duplicate physical Source through another identity/calibration cannot charge the same pitcher play twice.
- Same policy Source/version changed in place must be rejected; reopen uses the original accepted snapshot.
- Corrupt official/scoring/participation/source evidence or failed Source/workload phase must not silently accept or duplicate fatigue.

### Task 1: Read-only actual official pitch evidence

**Files:** Modify `src/host/SqliteOfficialScoringStore.ts` and `src/host/world/SqliteOfficialParticipationStore.ts`; create `src/host/world/SqliteOfficialPitchWorkloadStore.test.ts` (real Native fixture) and `src/core/world/development/OfficialPhysicalPitchWorkload.ts` with tests.

**Interfaces:** Scoring `readAcceptedPlay(scoringApplicationId)` returns `{ scoring, application }` after existing full decode/official hash replay. Participation `readPitcherPlay(gameId, activationApplicationId, closureApplicationId)` infers the unique P defender from the actual activation World, binds the existing accepted Player/Person/game scope and validates the existing official application chain. It does not manufacture another persisted appearance receipt.

- [x] Capture missing read-API RED using actual Native activation/closure/scoring and actual resolved physical pitches.
- [x] Add read-only evidence APIs by reusing existing validators; preserve existing write/receipt/scoring behavior.
- [x] Count only supported physical pitch events and their matching count events, reject unbacked count events and nonphysical timelines, validate finite explicit effort calibration and overflow. Retain physical Source sequences as provenance.
- [x] Verify taken/missed/contact actions, invalid evidence, action-count causality and original Native read compatibility.

### Task 2: Durable generated Source and existing workload adoption

**Files:** Create `src/host/world/SqliteOfficialPitchWorkloadStore.ts`; update the new integration tests and create `docs/project-status/2026-10-01-official-physical-pitch-workload.md`.

**Interfaces:** Accepted policy `{ sourceId, sourceVersion, policyId, version, availableAtDay, effortUnitsPerPhysicalPitch }`. Producer `accept({ scoringApplicationId, activationApplicationId, policySourceId })` returns an exact generated `PlayerWorkloadActivity` of kind MATCH. Source identity is derived from actual game/play/pitcher, not the supplied policy or alias. `readAcceptedActivity(sourceId)` validates original Native evidence and stored calibration and serves the existing workload authority.

- [x] Capture missing producer RED, then implement frozen accepted policy/Source archives and exact original retry/reopen behavior.
- [x] Actual Native physical pitches -> official scoring + actual P actor -> generated Source -> existing workload.apply; assert correct global Player fatigue/revision and immutable original retry after recovery/reopen.
- [x] Reject Source/policy/scope corruption and duplicate charge, inject late Source/workload write failure and retry safely.
- [x] Focused 7 files /30 tests and typecheck passed. Fresh review's three Important findings each had corrective RED and were fixed; reviewer confirmed no remaining findings and independent 2 files /10 tests. Whole `npm run verify` passed 532 files /3,157 tests in 664.04s.
- [x] Published stacked PR236 on PR235 at `e848c765ded4f8fda3c5f59888f05982ce931d78`; attachment attempted once (100-cap rejection). Exact-SHA P0 run36848242418 succeeded.
- [ ] Continue confirmed physical/runtime/Career residual work; this pitch Source slice does not complete the overall goal.
