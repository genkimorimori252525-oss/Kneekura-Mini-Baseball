# Source-backed MatchImportance and Appraisal implementation plan

> For agentic workers: use superpowers:executing-plans, task by task with assertion RED/GREEN.

Goal: derive per-player match importance and five emotional appraisals from current source snapshots and feed the ONE existing ActiveEmotion gate, without UI or direct outcome effects.
Architecture: immutable, pure source -> automatic importance -> versioned numeric appraisal -> existing gate. No new persistent emotion ratings, duplicate Trait buffs, generation flags or second gate.
Tech stack: existing TypeScript/Vitest, no dependencies.
Spec: approved design 05 §§3–7,10,12–13;08 §15.50;09 §10.1;52 §4 at 782f6b8ef2406839de5678b00040001111cd8f77. Parent PR35 e405394e9841c6a183d0234da069dc2d1712b54e.

## Global constraints
- No UI, rendering, physics/swing or pre-existing owner changes. No branch merge.
- Neutral influence remains zero. Importance and labels do not directly affect execution.
- Only realized current response enters. Candidate flags and named trait grades are excluded.
- Production coefficients/thresholds are not frozen by the source: explicit caller-supplied versioned calibration, NO production default.
- Counterfactual competition projections, personal history and current response remain their source owners' responsibility. We compute leverage/importance/appraisal, not a new league solver or human-psychology model.

## Rulings (implementation choices, not newly claimed approved numerical standards)
- Two competition projections (own win/own loss), current remaining games and stage identify leverage. Rank leverage is normalized by field size; terminal state differences and opponent rank swing are distinct components.
- PersonalStake is max(record,return,history,directed rivalry * club identification); no duplicated sum of the same personal salience.
- Importance is a normalized nonnegative weighted mean, with stage values from explicit calibration. Unknown data is rejected rather than filled with low importance.
- Appraisal uses bounded linear rows over current situation and response features, amplified by importance. Effects are bounded numeric offers; their common normalized size, not pressure alone, drives the gate's comparison.
- Full normalized source+model input is retained as provenance. IDs require authenticated immutable host registries; consistency is not authenticity.

## Review focus
Stale/backdated source reuse; different match/player/opponent; duplicated semantic source IDs; hypothetical states inconsistent with tournament rules; effect underflow/tick rounding and hidden neutral effects.

## Tasks
- [x] 1. MatchImportance types/parser/computation, explicit temporal/source binding, tests.
- [x] 2. Five-candidate numeric appraisal with current response and configurable effects, tests.
- [x] 3. Existing gate composition plus deterministic recomputation/replay and integrity tests.
- [ ] 4. Review, native full suite, source hash check, API/status docs, dedicated PR.

Pre-flight: task1 produces normalized source inputs and importance; task2 emits the existing EmotionAppraisal; task3 must call evaluateEmotion/getEmotionInfluence rather than implement selection, sustain or replay logic anew.

Local review done:90 new +81 inherited tests pass. Native full suite and PR completion are recorded against the exact published SHA in the PR, not inferred from local adaptation.
