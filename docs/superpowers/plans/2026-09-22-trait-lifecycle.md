# Player Trait Lifecycle and Green Intent Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. This executes the user's existing confirmed-plan queue; it does not approve new UI design.

**Goal:** Enforce family-specific trait persistence and slow preferences without making trait labels an ability source.
**Architecture:** Explicit versioned registry from canonical09, pure immutable career/player reducer, independent numeric preference/directive arbitration, checkpoint+tail replay. Existing emotion, physical, roster and world owners stay unchanged.
**Tech Stack:** Existing TypeScript5.6/Vitest2; no added dependencies. Node26 native verification, Node22 supplemental local tests.
**Spec:** `docs/game-design/09-player-trait-catalog.md` §§2.3–2.7,3,5.11,6.3,15 and `53-player-development-trajectory-breakthrough-v1.md` §§16,20–24 at `782f6b8ef2406839de5678b00040001111cd8f77` (design branch).

## Global Constraints
- No UI, renderer, physics, rule-owner, package or lockfile changes.
- Lifecycle comes from canonical family identity, never names/colors.
- Exactly one effective state per family. Gold inherits lifecycle.
- No fixed trait count cap; no free skill/source changes from a label.
- Learned mastery requires distinctiveness, repetitions, practice persistence and consolidated source evidence; real execution feasibility is external.
- Green requires multiple internalized voluntary/accepted episodes and persistence with enter/leave hysteresis. Five transitions per season are a diagnostic, not a hard cap.
- Numeric directives do not edit stored preference or award learned skills.
- Authentic sources, finite opportunity accounting, global deduplication and atomic save commits are host responsibilities.

## Review Focus
1. A repeated assessment or reused source snapshot must not simulate extra practice.
2. A forged checkpoint must not create unearned or downgraded persistent mastery.
3. Cross-player/career, stale revision, backdated time and bad source provenance must fail without mutation.
4. Hard commands cannot silently fall back to the player's preference when illegal/unaccepted.
5. Source naming/display/color changes must not change lifecycle or physical output.

### Task1: Explicit registry and lifecycle reducer
**Files:** `src/core/world/traits/TraitTypes.ts`, `TraitFamilies.ts`, `TraitValidation.ts`, `TraitState.ts`, `TraitLifecycle.ts`, `TraitLifecycle.test.ts`, `TraitFixtures.test-support.ts`.
**Consumes:** source-owned evidence (revision, snapshot, evaluation provenance).
**Produces:** `getTraitFamilies()`, `createTraitState(input)`, `evaluateTrait(state,input)`, `getTraitPortfolio(state)`.
- [x] Write tests through public functions: all13 graded families downgrade from supported top tier to B; consolidated learned mastery persists after low/absent current expression; catalyst alone fails acquisition; no duplicate family states.
```ts
const state = value(createTraitState(fixtureCreation()));
const next = value(evaluateTrait(state, fixtureEvaluation('fastball_quality', 'B')));
assert.equal(next.state.entries[0]!.effectiveStateId, 'B');
```
- [x] Run the native tests or documented supplemental runner; observe missing-feature RED before implementation.
- [x] Implement exact inert-data validation, detached frozen results, supplied per-family acquisition policy and source provenance checks.
- [x] Run tests GREEN and record evidence. Do not infer current execution skill from persistent mastery.

### Task2: Slow Green projections and independent numerical directives
**Files:** `GreenPreference.ts`, `PreferenceIntent.ts`, `GreenPreference.test.ts`, `PreferenceIntent.test.ts`.
**Consumes:** family policy (enter>leave, minimum observations/days), complete preference supports, internalized episode type, legal numeric action weights.
**Produces:** slow projection through `evaluateTrait`; `resolvePreferenceIntent(input)`.
- [x] Write tests: single command cannot switch Green; stable evidence across days can; boundary oscillations do not flicker; switching families does not combine opposite variants; fifth transition emits diagnostic without blocking sixth.
- [x] Write tests: NONE keeps player distribution; SOFT convexly blends provided distributions; accepted understood HARD gives exact one-hot legal intent; rejected/ununderstood command returns explicit rejection; input preference unchanged.
```ts
const result = value(resolvePreferenceIntent(intentFixture('HARD')));
assert.equal(result.hardActionId, 'contact');
assert.deepEqual(result.weights, [{actionId:'contact',weight:1},{actionId:'power',weight:0}]);
```
- [x] Run RED, implement minimal deterministic logic, run GREEN.

### Task3: Checkpoint validation, replay and handoff
**Files:** `TraitReplay.ts`, `TraitReplay.test.ts`, `index.ts`, `docs/core/trait-lifecycle-v1-headless-api.md`, `docs/project-status/2026-09-22-trait-lifecycle.md`, `.github/workflows/headless-traits-verify.yml`.
**Consumes:** validated state and accepted evaluation receipts; tail IDs are checked locally.
**Produces:** `restoreTraitState`, `replayTraitEvents` with exact receipt comparison.
- [x] Write replay roundtrip, compact checkpoint, tampered mastery/pending/evidence tests. Explicitly test mixed lifecycle and scopes.
```ts
assert.deepEqual(value(replayTraitEvents(start, receipts)), expectedState);
```
- [x] Run RED, implement restore/replay, run GREEN. Review source conflicts, numeric finiteness, sparse/accessor inputs and checkpoint plausibility.
- [ ] Run entire repository `npm run verify` on the exact published commit using existing read-only Windows/minibaseball runner; record actual log/test counts and all warnings.
- [ ] Publish only a dedicated stacked PR on PR31; no merge. Provide exact API/remaining owner boundaries and the next confirmed slice. Record test evidence rather than claiming complete psychology/development/special-ability integration.

## Local execution closure

Tasks1–3 functional behavior and inline review pass140 supplementary tests. Native final-commit verification and publication remain gated by actual CI evidence in the PR record. No separate reviewer agent was available. Read the status/API boundaries before claiming any runtime gameplay integration.
