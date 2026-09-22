# Two-strike source separation — continuation 2026-09-22

## Base / scope

Continue PR34 at `927e41be5dc8cbf5dc786c914eb24591c74a7565`, full tree `3bc3fba3f81f471ee8e26f61a958169436f5a4ae`, on dedicated branch `jolly/confirmed-headless-two-strike-2026-09-22`. No merge or shared-branch update.

Approved sources: canonical09 §§2.5–2.6,5.1,5.3–5.4,10.1 and53 §§18,21 at design SHA `782f6b8ef2406839de5678b00040001111cd8f77`. The user approved this next slice after the measured-classifier work. Do not restart completed PR30–34 or reimplement Swing Kinematics PR25/27.

## Delivered source boundary

Two APIs in `src/core/world/traits/twoStrike/index.ts`:

- `classifyTwoStrikeWeakness`: technical timing/adjustment residuals -> per-episode incidence -> exactly one null/RED/RED_EXTREME current descriptor. Requires repeated opportunities and elapsed evidence span; insufficient/stale evidence cannot imply recovery.
- `prepareTwoStrikeInput`: reuse actual TraitState and EmotionState validation/owners, preserve consolidated positive mastery proof, keep current numeric skill/feasibility independent of recognition, invalidate stale weakness classification, and expose exactly one unchanged emotion-gate channel.

No stored skill or mastery mutation, direct result probability, label-to-ability bonus, live swing execution, match collector or UI connection. Actual technical-vs-emotional attribution and physical feasibility remain source-owned. Exact residual metrics/thresholds are documented implementation/calibration choices, not numeric policy invented as frozen user design.

## Verification sequence

Supplementary strict TypeScript5.8.3/Node22.16.0 checks adapt only Vitest runner imports to node:test in temporary copies. Product source/assertions are unchanged. New tests:112 (20 classifier,24 composition,68 integrity). Existing trait/emotion/classifier regression tests:406. Final supplementary result:518/518 passed. This is not repository-native full-suite evidence.

TDD: Task1 rejection stub2/20 ->20/20. Task2 initially had a fixture helper type incompatibility between EmotionResult and TraitResult; fixed the helper, then21/44 ->44/44 assertion RED/GREEN. No claim the type error was a missing-feature assertion.

Inline review:108/112 ->112/112. Reproduced/fixed four assertions across three issues:

1. Observation-window off-by-one and impossible elapsed-span policy. Aligned windowDays with the existing measured classifier's day-count convention; adjusted the earlier boundary fixture to that convention.
2. Concerning incidence with too few repeated failures was returned as READY/null. It now remains unavailable, not falsely cleared.
3. A higher source revision could carry a snapshot timestamp older than the assessed source. Reject contradictory source chronology.

Review was inline, not an independent-agent audit. Full-game behavior, long-run population calibration and source authenticity are not proven by these tests.

Native exact-head `npm ci` / `npm run verify` must be read from the dedicated workflow's actual log after publishing. The associated PR's SHA-bound verification record closes these publication gates without a documentation-only retest loop. Preserve failure/warning details rather than infer native success from supplementary results.

## Change boundary

13 additions only:9 source/test files,3 documents and1 branch-only read-only verification workflow. All575 inherited local source-subset files remain unchanged; publication builds on the full remote base tree, not a truncated source export. No inherited physics/swing/rule/renderer/trait/psychology/package/lockfile/CI edit.

Parent dependency warnings:5 vulnerabilities (3 moderate,1 high,1 critical), plus esbuild install-script / Actions-host warnings. Not individually audited/fixed; no forced dependency update, script approval or warning bypass. Functional verification is not a security audit.

## Next confirmed work

Review canonical05/08/09/52 for source-backed Appraisal / MatchImportance and numerical consumers, using the existing single ActiveEmotion gate rather than a second pressure bonus. This slice only assembles inputs; actual behavior/physics consumption and collectors remain pending. Existing live Swing Kinematics must be read at its current ref before later integration, never replaced with the historical first-order path.

Remaining parallel queues: joint wild-stuff quality/command classifier, matchup/history recognition, full trait catalog and calibration, team traits, competition/calendar, scouting/development, manager/world/economy production setup and persistence. Those are not completed by this PR.

API: `docs/core/two-strike-source-separation-v1-headless-api.md`
Plan: `docs/superpowers/plans/2026-09-22-two-strike-source-separation.md`
