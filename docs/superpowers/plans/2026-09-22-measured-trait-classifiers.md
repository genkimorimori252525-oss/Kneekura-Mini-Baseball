# Measured Trait Classifiers Implementation Plan

> For agentic workers: execute with superpowers:executing-plans task-by-task; preserve the user's approved nonvisual boundary.

**Goal:** Turn actual contact/spin/command/failure observations into five existing source-trait assessments without caller-written classification labels.
**Architecture:** A pure statistical recognition layer upstream of PR33. Inputs bind player/career, a versioned source snapshot, event/episode/time evidence and explicit numeric calibration. Ready assessments use the existing SourceTraitAssessment contract; unavailable data never produces a false ABSENT assessment. No new simulation, mastery, UI or save authority.
**Tech Stack:** Existing TypeScript/Vitest, no dependencies.
**Spec:** frozen `782f6b8ef2406839de5678b00040001111cd8f77`, game-design09 §§2.6/4.1/4.2/4.9/5.1/10.1 and53 §§18.1/20/21.4. PR33 APIs are the integration boundary.

## Global constraints

- Current Source State -> descriptor; never descriptor -> physics/results.
- RECOGNITION is not DEVELOPMENT; all produced assessments explicitly say RECOGNITION.
- Existing Swing Kinematics PR25/27 is not reimplemented, merged or edited.
- No UI, marks, buttons, renderer, live effect application, flat ability or hit/out probability changes.
- Actual money/world setup and pressure/two-strike mixed lifecycle decisions remain separate.
- Numerical thresholds are explicit caller-owned versioned calibration, NOT values claimed approved by the design or real-world baseball standards.
- Runtime uses inert JSON-shaped inputs, no disk/network/time/randomness.

## Review focus

- Same play replayed as frames/IDs: reject duplicate events/instants; count distinct episodes, not frames.
- Old source or empty/short observation windows: unavailable/null assessment, never confirmed absence.
- Intentional location changes or consistent bias: centered actual-minus-target dispersion, not actual-position spread.
- Normal pitch movement: never substitute trajectory for explicit delivery-failure observations.
- NaN/zero motion/overflow, wrong subjects, future/contradictory chronology and mutation: reject or preserve deterministically.

## File responsibilities

`src/core/world/traits/classifiers/MeasuredTraitTypes.ts`: public typed inputs/results and units.
`MeasuredTraitValidation.ts`: inert input/schema/model/evidence validation, chronological sorting.
`MeasuredTraitStatistics.ts`: numerical summaries/classification algorithms only.
`MeasuredTraitClassifier.ts`: window/evidence gate, assessment assembly and frozen results.
`index.ts`: one public operation and types.
`MeasuredTraitFixtures.test-support.ts`: synthetic calibration/evidence, never production defaults.
`MeasuredContact.test.ts`, `MeasuredPitch.test.ts`, `MeasuredTraitIntegrity.test.ts`: behaviors and regressions.
Documentation: this plan, headless API, project status. One branch-only verification workflow.

## Task 1 — Launch-distribution recognition

Consumes: `SourceTraitAssessment`, `TraitSourceSnapshot`, `TraitScope`, `TraitTime`.
Produces: `classifyMeasuredTrait(input: unknown): TraitResult<MeasuredTraitClassification>` for line_drive and pitcher_contact_distribution.
- [x] Write tests for upward-Y launch angles, actual launch ratios, exclusive ground/fly states, raw-state immutability, changed version thresholds and evidence gates.
- [x] Run tests against a missing-feature stub; observe assertion failures.
- [x] Implement validated contact observations and pinned, caller-supplied angle/fraction rules.
- [x] Verify existing traits and new tests, record RED/GREEN.

Core test assertion:
```ts
const result = value(classifyMeasuredTrait(contactFixture()));
assert.equal(result.assessment?.stateId, 'LINE_DRIVE');
assert.equal(result.assessment?.changeKind, 'RECOGNITION');
```
Run: `npm test -- src/core/world/traits` (native runner); local isolated node:test adaptation is supplementary only.

## Task 2 — Spin, command and failure recognition

Consumes: same input/result envelope; produces three further model variants for gyro_pitch_shape, command_instability and release_miss_pattern.
- [x] Add spin-axis alignment/joint high-spin, target-relative dispersion and explicit directional delivery-failure tests.
- [x] Observe RED before implementation.
- [x] Compute dimensionless axis alignment, radians/second->rpm, centered vector variance and normalized direction concentration; never apply those descriptions as buffs.
- [x] Verify all tests and record GREEN.

Critical assertions:
```ts
assert.equal(value(classifyMeasuredTrait(intentionalTargetChanges())).assessment?.stateId, null);
assert.equal(value(classifyMeasuredTrait(oppositeReleaseMisses())).assessment?.stateId, null);
```

## Task 3 — Projection integration and adversarial review

Consumes READY assessments; outputs existing PR33 projections, not a second projection implementation.
- [x] Test actual measured observations -> classifier -> projectSourceTraits; stale current snapshot invalidation and before/after comparison.
- [x] Test insufficient numeric evidence returns no assessment; zero spin is not gyro, failure-only labels cannot arise from command data, calibration collisions are not silently resolved.
- [x] Test input integrity, duplicates, temporal/window edges, event/episode counts and deterministic permutation; fix reproduced defects RED/GREEN.
- [x] Document algorithm choices versus frozen design, host responsibility and unfinished pressure/mixed-class work.
- [ ] Publish on a new branch based on exact PR33 SHA; run native whole-repository `npm ci` / `npm run verify`, inspect exact-SHA logs, keep PR unmerged.

## Implementation rulings

Five numeric classifiers are the current slice. Wild-stuff, matchup/history automatic classification and mixed positive/negative two-strike/pressure ownership are NOT guessed: wild-stuff needs a defined joint quality-source contract; mastery must persist while current negative execution can change independently. These remain next-review items. Samples are an explicitly selected owner-provided population (sourceKey); no undocumented fair/foul/bunt or pitch-type selection is introduced.

The algorithm is an initial explicit implementation policy, not a claim that the design specifies exact statistical equations. Contact ranges are half-open; pitcher ground/fly populations are disjoint and minimum shares must sum to >1. Gyro high-spin share is JOINT alignment+spin, not independent averages. Command dispersion is population RMS around mean error; systematic bias is reported separately. Failure concentration uses unit miss directions only for explicit failed deliveries meeting the minimum magnitude.
