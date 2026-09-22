# 2026-09-22 — Source-backed MatchImportance / Appraisal

Parent PR35 e405394e9841c6a183d0234da069dc2d1712b54e; dedicated branch jolly/confirmed-headless-appraisal-2026-09-22. User approved continuation of frozen nonvisual plans. No UI/design connection or shared-branch merge.

## Implemented

Three public pure APIs: automatic win/loss competition leverage + personal importance; numerical five-candidate appraisal from realized response/current context; atomic proposal through the one unchanged emotion gate. Dependencies/lockfile, existing physics/swing/rules/trait/psychology/CI sources are unchanged. Unknown/stale inputs reject rather than imply calmness. Raw normalized source/model provenance is retained. No candidate flag, Trait-name bonus or direct result probability is read.

Approved sources 05/08/09/52 establish causal ownership and behavior. Exact weighted-mean/linear-row arithmetic and caller-supplied versioned calibration are explicitly implementation choices, not falsely claimed frozen constants. No production default or calibrated population is supplied. Full contract/limitations: docs/core/source-appraisal-v1-headless-api.md.

## Local verification and review

Local npm offline installation failed ENOTCACHED; no dependencies were updated. Supplementary strict TypeScript5.8.3 + Node22.16.0 runs used temporary copies changing only Vitest runner imports to node:test. Final 171/171: 81 inherited gate tests + 90 new tests (25 importance,26 appraisal,11 composition,28 integrity). This is NOT the native whole-repository suite.

TDD assertion failures -> passes: importance98/106->106/106; appraisal122/132->132/132; composition134/143->143/143. The composition test initially accessed the replay result's wrong property; fixed from state to existing value contract BEFORE its assertion RED/GREEN. Review initially had one malformed inverse-rank test (equal ranks are legal); corrected that fixture, leaving three real failing normalization assertions168/171. Timing offers exceeding comparison scale clipped unequal effects into identical impacts. Rejecting such calibration fixed all three;171/171 afterward. Signed rounding, tiny relative weights, getters/sparse records, source ages/scopes and candidate-flag exclusion are covered.

Review was inline, not an independent reviewer agent. Thirty accepted appraisal events replay through the inherited gate; this is not a full match or multi-season population simulation. No claim every negative assertion failed against the initial rejection-only stub.

Native exact-head npm ci / npm run verify is required before ready-for-review. The PR record and downloaded exact-SHA artifact close this gate without a docs-only commit/retest loop. Existing dependency warnings (previously3 moderate/1 high/1 critical) remain unaudited/unfixed; actual current run warnings must be reported separately. Functional testing is not a security audit.

## Resumption

Read the dedicated PR exact-SHA verification record to distinguish complete from pending. Do not reimplement PR30–35. Next: actual numerical decision/execution consumer and coherent source/gate/world acceptance, reviewed against current production Swing Kinematics branch before integration. No physics formula or observer redesign is authorized here. Full upstream standings/projections, realized-response/history production and calibrated models remain separate work; the caller must not substitute hand-entered importance or fabricated current response for them.

Other remaining work: joint wild-stuff and matchup/history recognition, remaining traits and calibration, team traits, competition/calendar, scouting/development, world/economy/manager services and persistence. No automatic background continuation is claimed.
