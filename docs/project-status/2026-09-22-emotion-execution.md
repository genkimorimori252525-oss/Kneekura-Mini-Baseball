# 2026-09-22 — Single-gate numerical execution and runner-motion continuation

Parent PR36/head `fd5c8b10fbd3c64bed02ec444fde3a9eee5e383f` was re-read through live GitHub. Completed appraisal, two-strike, trait and catalog work was restored, not reimplemented. Work is isolated and additive; no shared-branch merge, source/dependency/renderer edit.

## Delivered

- `prepareEmotionExecution`: current source/frame -> existing appraisal/gate -> one six-channel numerical decision input. Fresh baseline means no accumulation or inverse-patching on clear.
- Optional runner integration calls real `decideRunnerMotionIntent` and `buildRunnerMotionTrajectory`, changing only required safety margin. Same physical parameters and race estimates can yield hold versus advance and different actual motion trajectories. Force/tag-up/threat/coach priorities remain with existing Core.
- `acceptEmotionExecution`: exact recomputation against the current request and whole-bundle comparison; returns before/after world/gate adoption references plus the complete result, never a partial write.
- Numerical saturation/feasibility and expired windows are explicit. Backdated runner decisions, inconsistent source frames, tampered proposals, non-finite output and malformed inert data reject.

## Verified source and scope ruling

Approved psychology05 §§2,3.1,7,8,12,13 at design SHA `782f6b8ef2406839de5678b00040001111cd8f77`. PR36 remains appraisal owner. Production swing PR27 at `7b1b84aafa5d79499740d556fd44cef63b4f2c26` was read live. Its whole-bat timingOffsetTicks must not be mistaken for a swing-decision commitment shift. No second swing model or blind mechanical timing mapping was added.

Positive-risk-to-margin conversion and saturation/rounding are documented implementation/calibration choices; no fixed production coefficients. All six emotion channels reach numerical inputs, but only running risk reaches a concrete existing action/motion consumer here. The other consumers remain unfinished.

## Tests and honest provenance

Supplementary strict TS5.8.3/Node22.16: **304/304 tests passed**, 171 inherited emotion/appraisal and133 new (33 numeric input,29 runner,34 acceptance,37 integrity). Temporary copies change only `vitest` runner imports to `node:test`. Product source and assertions unchanged. This is not native full-repository verification.

Observed assertion RED/GREEN:14/33->33/33;49/62->62/62;90/96->96/96. Task1 had an aliased test frame correction. Task3 had a wrong replay result type corrected before assertion RED and a no-op threshold edit corrected afterward. New integrity tests reached129/129. Inline review then reproduced four real invalid attention-target cases,129/133->133/133 after source-union validation. No independent-agent review was available.

Local npm offline installation failed ENOTCACHED. Dependencies/lockfile remain unchanged. Native exact-head `npm ci` and `npm run verify` on the existing Windows/X64/minibaseball runner must be inspected before marking the PR ready. The exact-SHA PR verification record closes this committed prepublication gate without a documentation-only retest loop.

## Remaining and next

Actual source collection, production calibration and database/world-scheduler compare-and-swap are not implemented. Accepted trajectories are plans, not full world progression; interrupted actions need normal event handling. Gate receipt consistency is not cryptographic evidence or global deduplication. A host must not release this as an on-screen emotion feature until the same gate state drives observation too.

Next confirmed dependency: numerical batting/throwing/replan consumers, preserving early decision versus physical phase timing and perception cut-off. Existing standalone production swing must be reused through its verified boundary. No new skeleton/physics, old swing fallback, or UI connection.

Keep separate: joint wild-stuff quality, matchup/history recognition, remaining trait calibration, team traits, competition/calendar, scouting/development, manager/world economy, production data and persistence. Prior dependency warnings (3 moderate/1 high/1 critical) remain unaudited/unfixed; record actual native-run warnings at closure.

API: `docs/core/emotion-execution-v1-headless-api.md`
Plan: `docs/superpowers/plans/2026-09-22-emotion-execution.md`
