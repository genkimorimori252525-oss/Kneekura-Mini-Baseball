# 2026-09-23 — Batting commitment and existing rigid swing consumer

## Scope and sources

Continues PR38 head a03bd4587d588135c0a0446dff22dd10fe8dcff5. Branch jolly/confirmed-headless-batting-2026-09-23. Existing completed PR27 head7b1b84aafa5d79499740d556fd44cef63b4f2c26 was rechecked before integration. Psychology05 frozen at782f6b8 remains behavioral authority. The user authorized this nonvisual continuation; no design/UI handoff is inferred.

## Delivered behavior

Actor commitment consumes only available, time-stamped predictions and the one accepted gate. Separate physical evaluation uses actual flight without replanning. Decision and motor onset differ; readiness/latency may delay all physical trajectory phases. Early commitment can retain a coarse prediction and causally miss the same pitch that the neutral refined prediction contacts. Delayed motor onset also changes actual contact/miss. No hit/miss sampling, trait-label buff or second swing engine.

All request/result data are detached and immutable; current scopes, gate state, ball identity, count and canonical timeline cursor are checked. Non-ready states are not silently converted to TAKE. Acceptance recomputes the full current proposal and binds one action key independent of source ID. Canonical forecasts are not world/database writes.

Exact upstream reuse:24 files listed in docs/core/emotion-batting-reused-sources-v1.json, at their canonical paths. This includes23 additions and one existing compatibility-alias update in BatBallContact.ts. BallFlight and the old coordinator implementations are NOT overwritten. The whole PR27 and its renderer assets are NOT merged.

## Verification and review ledger

Bootstrap1a396c6, run35748103652, exported the exact source/swing snapshots and passed the parent282 files/2245 native tests. This is baseline evidence only.

New consumer tests:99. Local strict TypeScript5.8.3 / Node22.16.0 supplemental run passes491/491 including392 inherited psychology/appraisal/execution/fielding tests. Only Vitest imports are changed to node:test in temporary copies; product/assertion code is unchanged. This is NOT the repository-wide native suite.

Observed assertion RED/GREEN: timing2/17->17/17; commitment21/40->40/40; acceptance50/53->53/53; physics59/69->67/69->69/69. Initial compile revealed a required upstream compatibility alias and a fixture emotion-name typo; corrected before assertion cycles. Two intermediate physics failures came from existing optional orientation:undefined output, normalized only on trusted computed outputs.

Inline review added30 tests;96/99 reproduced three genuine defects: between-knot overspeed, expired body/profile source at motor onset, zero orientation quaternion. Bounded continuous speed certification, onset validity checking and the existing quaternion validator produced99/99, then491/491 regression. No independent reviewer agent was available.

Native final-head npm ci/npm run verify and publication are pending at this prepublication checkpoint. The PR's exact-SHA run/log/manifest record closes these gates without a docs-only retest loop. Retain actual warnings and any native failures explicitly; do not infer native success from supplementary output.

## Remaining and next

The concrete batting library path now reaches existing rigid contact/canonical outcomes. Full scheduling/interruption, genuine perception/source generation, calibrated feasible profiles, coordinator adoption and atomic world/event/persistence remain unfinished. Returning a trajectory or future count is not permission to advance the whole game or apply those events immediately.

Next dependency review: unify accepted action scheduling/revalidation and actual event adoption for the now-connected batting/running/throwing/defensive paths; inspect existing Core action-frontier/closure authorities before adding another scheduler. Continue approved nonvisual scope only. Whole-career completion is not implied. Remaining trait recognition, team traits, competitions/calendar, development/scouting, manager/world/economy and persistence/long-run validation remain as in the coverage inventory.

Dependency warnings inherited: five vulnerabilities (3 moderate,1 high,1 critical), unaudited/unfixed, plus esbuild warnings. Record actual final-run warning changes in PR evidence. No forced upgrades, extra script approval, warning bypass, new dependency or UI/renderer work.
