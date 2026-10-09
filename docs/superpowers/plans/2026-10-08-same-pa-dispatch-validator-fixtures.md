# Validator-only effective calibration fixture proposal

Scope: independently declared synthetic response Sources for Source shape/domain tests only. No database acceptance, owner proof, physical execution, genuine qualification, or claim that unchanged nominal values model fatigue. No new numerical values. The parser has no nominal-copy fallback; each route test explicitly selects its values and includes distinct fixture-only provenance.

Provenance for each Source: assessmentSourceId=`dispatch-validator-shape-<route>`, assessmentVersion=`fixture-shape-only-v1`, calibrationSourceId=`dispatch-validator-independent-declaration-<route>`, calibrationVersion=`fixture-shape-only-v1`. Member/view refs are explicitly synthetic. `acceptedAtDay` uses existing fixture day 11 and parser validation receives authenticated test game day 11. The Source is never written as genuine evidence.

Exact unchanged response selection:
- pitch_delivery: reference-only to existing world_pitch_fatigue_policies fixture owner; no new numerical policy.
- batter_observation: batting-sensor-calibration/test-sensor-v1 values at NativeBattingModelStanceFixtures lines 155–158 (including its explicit 1,000,000 ticks/sec and 10,000 latency).
- batter_decision: batting-decision/test-decision-v1 values, line 149–150.
- batter_motor: batting-capability/test-motor-v1 values, lines 137–138.
- batter_swing: batting-repertoire/test-repertoire-v1 full values, lines 139–148.
- defender_observation: observation-a/synthetic-observation-v1 calibration, unchanged playerObservationCalibrationFixture().
- defender_decision: decision-a/synthetic-decision-v1 calibration, unchanged playerDecisionCalibrationFixture().
- defender_locomotion: locomotion-a/synthetic-locomotion-v1 calibration, unchanged playerLocomotionCalibrationFixture().

Nominal references remain separately typed to world_player_batting_models (with exact embedded parameter key/source/version/hash), world_player_observation_models, world_player_decision_models, world_player_locomotion_models and the pitch timing endpoint union world_pitch_timing_baselines | world_pitch_timing_updates. For pitch_delivery, nominalParameterReference is null; response.policyReference separately pins world_pitch_fatigue_policies. The later consumer/action proof requires equality to action.timingReference and action.pitchResponseReference; release and nominal delivery physics remain pinned through that action. The same numerical values here prove syntax/domain acceptance only. Output-sensitive effective-vs-nominal adapter tests still need a separate concrete declaration packet.

Pinned source files:
- `src/host/world/NativeBattingModelStanceFixtures.test-support.ts` SHA-256 `b96f011ee1c74cf1427d5e547fd08ddd030ad5ab6cd7598ddc4bcea811b22016`
- `src/host/world/PlayerObservationModelFixtures.test-support.ts` SHA-256 `4b20d81674a032826bb640919b8cea0148177a9e55a006f94fc20947136c9049`
- `src/core/sim/perception/PlayerObservationCalibrationFixtures.test-support.ts` SHA-256 `1f9438c782db3b06bc6b166ba9c8f5bfdb8bd43462cfbb4dadeecfe7db0a2fde`
- `src/host/world/PlayerDecisionModelFixtures.test-support.ts` SHA-256 `5282934a883e33e3b56cea1217ce977c69b26d43b54c9683a3815bc47778588e`
- `src/core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support.ts` SHA-256 `3d33b1a7ab3307fea15de23e64014acb91129db71155813ec6641b794cf979c4`
- `src/host/world/PlayerLocomotionModelFixtures.test-support.ts` SHA-256 `3442620b1cf1d414c486342ff42a3f87d8f524834139e7bb96d0bf9280c37787`
- `src/core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support.ts` SHA-256 `576adf1808c7ce2ef999c992aea1f3a35d4b3bc5efa2de10a8168db05ccd3cf5`
