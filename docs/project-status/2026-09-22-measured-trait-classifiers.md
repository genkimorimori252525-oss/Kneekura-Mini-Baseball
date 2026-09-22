# 2026-09-22 — Numeric source-trait classifiers

## Continuation

Base: PR33 head `9e260ab4dd41f8b1793d521fe29d7da7e0c7fa01`, tree `2ccd1ca1252f0c7b6148e7dd6233adf8348fc15a`.
Dedicated branch: `jolly/confirmed-headless-trait-classifiers-2026-09-22`.
User approved continuing the confirmed nonvisual queue. PR30/31/32/33 work is retained, not reimplemented; completed Swing Kinematics PR25/27 remains separate and untouched. No merge/shared-branch rewrite.

## Delivered slice

One public classifier API for five existing families: actual launch distribution (batter line-drive, pitcher ground/fly), same-observation spin/velocity geometry, target-relative command dispersion, explicit directional delivery-failure pattern. Uses existing SourceTraitAssessment/PR33 projection. No caller-provided descriptor state is accepted in the numeric input.

Window/age/episode evidence gates distinguish unavailable from confirmed absence. Multiple events in one episode do not become multiple episodes. Source owner, player/career, IDs, chronological consistency, exact input shapes, finite numbers and representable arithmetic are checked. Outputs are immutable detached data; raw observations/calibration accompany provenance. Classification is RECOGNITION, never development or an execution effect.

Numerical thresholds remain explicit versioned caller calibration; the frozen design supplies causal ownership, not the implementation's exact numerical equations. See API for algorithm definitions/limitations and a strict distinction between registry/library integration and live-game integration.

## Verification ledger before publication

Local npm dependency installation failed due to registry DNS EAI_AGAIN. No dependencies/lockfile were changed or vendored. Supplementary strict TS5.8.3/Node22.16 testing uses temporary copies with ONLY the Vitest runner import adapted to node:test (and a separate compiler config). It is not the native whole-repository suite.

Inherited baseline:237 tests pass. Task1 RED237/255 -> GREEN255/255 (18 new contact tests). Task2 RED256/277 -> GREEN277/277 (22 pitch tests; one validation case already passed). Integrity/integration:324/324. Inline review added a real failing tiny-dispersion regression324/325; small-residual normalization fixed squared underflow, GREEN325/325. Final new count88:18 contact,22 pitch,48 integrity/integration. A temporary fixture-refactor import error was corrected in test support; it was a compiler error, not a claimed behavioral RED.

The 300-observation determinism test covers classification/ordering, not seasons or full matches. Review is inline, not independent-agent review. Existing parent dependency warnings (3 moderate,1 high,1 critical) remain unaudited/unfixed; local install failure is not evidence those have disappeared.

Native `npm ci`/`npm run verify` and exact-SHA export verification are publication gates. The final PR body/comment plus Actions artifact bind the eventual result to the actual final head; do not infer native success from this prepublication record. This avoids a documentation-only re-test loop.

## Scope fence and next location

All changes are additions under the new classifiers directory plus this status, the API, plan and one branch-specific read-only workflow. Existing source/package/lock/CI is not edited. The full parent tree is retained on publication even though the local recovered workspace is a source subset.

Next: source ownership/contract for mixed two-strike positive learned technique versus current negative adjustment, then pressure Appraisal/MatchImportance and numerical consumers. Source09/53 must remain authoritative; do not downgrade/delete learned mastery merely to consolidate labels. Wild-stuff needs a defined joint quality-source classifier. Other matchup/history families, production calibration, event collection, game/persistence integration, world/economy setup, competitions/calendar, manager/scouting/development and team traits remain queued. No design/UI connection.
