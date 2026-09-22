# Two-strike source separation implementation plan

> Execute inline using superpowers:executing-plans; test-driven-development applies. User approved continuation of confirmed nonvisual plans.

**Goal:** Recognize current technical two-strike weaknesses without deleting learned technique, and assemble source-backed execution inputs without a duplicate pressure bonus.

**Architecture:** A numerical classifier reads technical-only observations. A read-only assembler reuses the existing TraitState and EmotionState owners. No second skill store, physics engine, outcome sampler or UI.

**Tech stack:** Existing TypeScript / Vitest, no dependencies added.

**Spec:** Canonical `docs/game-design/09-player-trait-catalog.md` §§2.5–2.6,5.1,5.3,5.4,10.1 and `53-player-development-trajectory-breakthrough-v1.md` §§18,21 at `782f6b8ef2406839de5678b00040001111cd8f77`. Existing PR32 learned lifecycle and PR31 ActiveEmotion gate. Base PR34 `927e41be5dc8cbf5dc786c914eb24591c74a7565`.

## Global constraints

- `learned technique remains + current physical / cognitive / health feasibility + current context -> actual execution`.
- `三振 + 扇風機` must not be applied together. Negative family tiers are exclusive; learned positive technique is a different lifecycle.
- No hit/strikeout-probability bonus, direct grade-to-ability modifier, one-result mastery grant or pressure double counting.
- All numeric thresholds are explicitly supplied versioned calibration. This change does not designate production thresholds.
- Do not edit physics, Swing Kinematics, UI, existing lifecycle state, dependencies or shared branches.

## Rulings / scope

1. Maintain `two_strike_adjustment` and `cut_contact` persistent proof in the existing owner. Add a separate `two_strike_weakness` recognition family with null/RED/RED_EXTREME. This resolves mixed-lifecycle ambiguity without retroactive save rewriting.
2. Classify directly from nonnegative recognition timing error (simulation ticks) and adjustment residual distance (metres) supplied by a technical-only source. These residual measurements and per-episode incidence are explicit implementation choices; their attribution/collection/calibration is upstream, not asserted to be specified by the design.
3. Count each episode once; an episode qualifies when any observation crosses its threshold. Full representative opportunity capture is a host requirement. Insufficient/stale evidence is unavailable, never confirmed recovery.
4. Current numeric skill/feasibility is authoritative even when a named trait is unrecognized. Recognition never unlocks or boosts a numerical skill. Persisted mastery is audit provenance, not an effect.
5. Receive the existing complete EmotionState and recompute its one accepted influence. Bind it to match/context/world snapshot/revision/time. Never derive a second effect from pressure grades, nor add an emotion-inflated measurement to the technical channel.
6. Both APIs are pure library boundaries. Match collectors, source model/identity authentication, semantic event cadence, live execution/persistence integration, and full Appraisal/MatchImportance remain outside this slice.

## Review focus

- Strong technique + severe weakness must coexist; source recovery must not delete historical mastery.
- Duplicated event/time/episode grouping and source/model version mismatch must not fabricate evidence.
- A stale assessment cannot be used as current clearance; inadequate weak episodes cannot promote to extreme.
- Forged/stale neutral or active EmotionState and mismatched match/world/context must reject, not silently fall back.
- Changing a trait label alone must not alter numeric input; a already-emotion-adjusted technical source is rejected.

## Task 1 — numerical recognition

Files: `TwoStrikeTypes.ts`, `TwoStrikeValidation.ts`, `TwoStrikeWeakness.ts`, `TwoStrikeFixtures.test-support.ts`, `TwoStrikeWeakness.test.ts` under `src/core/world/traits/twoStrike/`.

Produces `classifyTwoStrikeWeakness(input: unknown): TraitResult<TwoStrikeClassification>`.

- [x] Test null/RED/RED_EXTREME, distinct timing/spatial causes, exact thresholds, two-strike-only evidence, per-episode recognition, source age, evidence span and deterministic ordering.
- [x] Run tests against a rejection stub and record assertion failures.
- [x] Implement validation, episode aggregation and mutually exclusive classification; retain normalized request and metrics.
- [x] Run focused tests and compile; record green.

## Task 2 — immutable source assembly

Files: `TwoStrikeInputs.ts`, `TwoStrikeInputs.test.ts`, `index.ts`.
Consumes classifier, `restoreTraitState`, `restoreEmotionState`, `getEmotionInfluence`.
Produces `prepareTwoStrikeInput(input: unknown): TraitResult<TwoStrikeInputBundle>`.

- [x] Test retained original mastery proof, current feasibility, exact source binding, count applicability and neutral/active emotion isolation.
- [x] Test numeric output independence from recognition/pressure labels, no double-counting and no mutation.
- [x] Run assertions red, implement read-only assembly, rerun green.

## Task 3 — adversarial boundary and delivery

Files: `TwoStrikeIntegrity.test.ts`, API/status docs, dedicated `.github/workflows/headless-two-strike-verify.yml`.

- [x] Test malformed inert objects, invalid numbers, sparse/accessor arrays, chronology, duplicate evidence, current source/proof identity conflict and obsolete model IDs.
- [x] Fix reproduced defects with failing assertions before changes.
- [ ] Run complete native `npm ci` + `npm run verify` on exact published SHA through existing Windows/minibaseball runner; inspect full output and record warnings.
- [ ] Verify the published file manifest; create a stacked PR without merge. PR exact-head verification closes publication gates without a documentation-only retest cycle.

Local supplementary checks may adapt only Vitest runner imports to node:test in temporary copies if dependencies are unavailable. They are not a substitute for native repository-wide verification. No independent review agent is available; record inline review honestly.

Ruling: windowDays follows the existing measured classifier (age < windowDays). Three review issues produced four failing assertions, then green. Native publication gates close through the PR exact-head verification record.
