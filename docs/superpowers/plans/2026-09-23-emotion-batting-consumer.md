# Emotion Batting Consumer Implementation Plan

> For agentic workers: use superpowers:executing-plans; continue this approved nonvisual queue without another design/UI handoff.

**Goal:** carry the one accepted emotion into batting commitment and the existing rigid bat/ball contact path.
**Architecture:** commit from available predictions only; freeze chosen intention/trajectory; resolve against actual flight separately. Reuse current emotion owners and exact existing Swing Kinematics source.
**Tech Stack:** existing strict TypeScript, Vitest, no dependency changes.
**Spec:** design branch782f6b8, docs/game-design/05-psychology-emotion.md §§2,3.1,7,8,12,13; completed PR27 rigid-swing migration7b1b84a. Execution contracts from PR37/38.

## Global constraints

- World-first causality. Never infer contact from a trait label or draw a hit/miss result.
- Design, UI, renderer, screens and buttons are excluded.
- Neutral uses the same baseline; consume one gate only; pressure traits are not another bonus.
- Decision commitment and motor onset are distinct. Predictions unavailable at cutoff are not usable.
- Actual flight is only consumed by physical resolution, never defaulted into actor prediction.
- Keep shared branches and other PRs unchanged; preserve exact source provenance for reused code.
- No guessed production coefficients or population-calibration claim; motor latencies and physically feasible profiles come from the owner.

## Review focus

Future/unavailable observations; obsolete gate/world contexts; mutation and duplicate source identities; delayed/overflowed onset; changing actual flight without changing an already committed swing.

## Task 1 — Commitment and temporal inputs

Files under src/core/world/psychology/batting: BattingTypes.ts, BattingValidation.ts, BattingTiming.ts, BattingCommitment.ts, BattingTiming.test.ts, BattingCommitment.test.ts, BattingFixtures.test-support.ts.
Consumes current accepted EmotionExecution, current EmotionState/ExecutionFrame, timestamped predicted trajectories, source-owned readiness/latency and versioned physical profiles. Produces a frozen commitment proposal, explicit waiting/missed/no-observation statuses.
- [x] Write failing selection/timing tests: cutoff excludes unavailable observations; equality is allowed; ambiguous duplicates reject; readiness cannot be bypassed; signed technical phase shift is independent of emotion commitment.
- [x] Run those assertions, implement minimal selection/readiness rules, rerun.
- [x] Test neutral matching, gate/current-scope consistency, read-only inputs, source validity and deterministic physical-profile choice.
- [x] Implement commitment using existing planner and whole-trajectory shift, not a reconstructed swing equation.

## Task 2 — Existing physical owners

Files: BattingResolution.ts and BattingResolution.test.ts; exact reused source manifest under docs/core.
Consumes accepted committed intent and a separately supplied actual aerodynamic flight. Produces existing canonical take/contact/miss resolution without replanning against actual truth.
- [x] Identify recursively required existing source modules/tests at7b1b84a; refuse conflicting existing implementations rather than silently replace them.
- [x] Test same commitment + changed actual flight yields different contact; changed future observations cannot rewrite committed intent.
- [x] Test whole-trajectory start/contact/end shift, rigid length preservation, contact/miss/take count behavior and physical interval exhaustion.
- [x] Reuse wood contact resolver and existing aerodynamic rigid pitch/timeline owners. No copied formulas.

## Task 3 — Adoption, integrity and publication

Files: BattingAcceptance.ts, BattingIntegrity.test.ts, index.ts; docs/core/emotion-batting-consumer-v1-headless-api.md, docs/project-status/2026-09-23-emotion-batting-consumer.md; dedicated headless-batting workflow.
- [x] Recompute submitted commitment against CURRENT owner input and reject altered or obsolete proposals.
- [x] Test exact action identity, count/player/ball scope, stale observation and prior acceptance reuse, fresh timeline and same-version model content.
- [x] Review inline if no independent reviewer is available; add failing regressions before fixes.
- [ ] Run strict checks and native npm run verify for the exact final published SHA; inspect actual logs and source manifest.
- [ ] Publish stacked PR, keep unmerged, record remaining scheduling, persistence, source-generation and calibration responsibilities.

Full-swing/season population behavior and live UI integration are not acceptance claims of this slice. Native verification is recorded against the final SHA in its PR, without a documentation-only retest loop.
