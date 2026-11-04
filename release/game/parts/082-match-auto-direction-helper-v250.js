
(function(root){
 'use strict';
 const policy=Object.freeze({version:'live_match_auto_direction_policy_v250',sourceId:'match-auto-direction-v250-ui'}),
  neutral=Object.freeze({version:'live_neutral_reactive_policy_v272',sourceId:'match-auto-neutral-v272-ui'});
 function forNextGame(core,selection,embedded){
  if(selection!=='legacy'&&selection!=='observed')throw Error('match auto direction v250: invalid selection');
  if(selection==='legacy')return Object.freeze({});
  if(!core.AUTHORED_LIVE_BATTER_OBSERVATION_V151||!core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153)throw Error('match auto direction v250: required policies unavailable');
  if(!embedded&&!core.AUTHORED_MATCH_RANDOMNESS_V152)throw Error('match auto direction v250: match randomness unavailable');
  return Object.freeze(embedded?{batterAutoDirectionPolicyV250:policy}:{...(core.LIVE_EMOTION_POLICY_V1?{emotionPolicyV1:core.LIVE_EMOTION_POLICY_V1,managerTacticsV1:true}:{}),...(core.LIVE_RUNNER_LEAD_POLICY_V1?{runnerLeadV1:core.LIVE_RUNNER_LEAD_POLICY_V1}:{}),...(core.LIVE_CATCHER_THROW_POLICY_V1?{catcherThrowV1:core.LIVE_CATCHER_THROW_POLICY_V1}:{}),...(core.LIVE_FIELD_THROW_POLICY_V1?{fieldThrowV1:core.LIVE_FIELD_THROW_POLICY_V1}:{}),...(core.LIVE_FIELD_RANGE_POLICY_V1?{fieldRangeV1:core.LIVE_FIELD_RANGE_POLICY_V1}:{}),...(core.LIVE_STEAL_RACE_POLICY_V1?{stealRaceV1:core.LIVE_STEAL_RACE_POLICY_V1}:{}),...(core.LIVE_HIT_BY_PITCH_POLICY_V1?{hitByPitchV1:core.LIVE_HIT_BY_PITCH_POLICY_V1}:{}),...(core.LIVE_RUNNER_THROW_READ_POLICY_V1?{runnerThrowReadV1:core.LIVE_RUNNER_THROW_READ_POLICY_V1}:{}),...(core.LIVE_FIELD_KINEMATICS_POLICY_V1?{fieldKinematicsV1:core.LIVE_FIELD_KINEMATICS_POLICY_V1}:{}),...(core.LIVE_LOCOMOTION_START_POLICY_V1?{locomotionStartV1:core.LIVE_LOCOMOTION_START_POLICY_V1}:{}),...(core.LIVE_FIELD_COVER_POLICY_V1?{fieldCoverV1:core.LIVE_FIELD_COVER_POLICY_V1}:{}),...(core.LIVE_RUNNER_TURN_POLICY_V1?{runnerTurnV1:core.LIVE_RUNNER_TURN_POLICY_V1}:{}),...(core.LIVE_FIELD_KINEMATICS_POLICY_V1&&core.LIVE_OUTFIELD_BREAK_POLICY_V1?{outfieldBreakV1:core.LIVE_OUTFIELD_BREAK_POLICY_V1}:{}),...(core.LIVE_FIELD_SHADE_CALIBRATION_V1?{fieldShadeV1:core.LIVE_FIELD_SHADE_CALIBRATION_V1}:{}),...(core.LIVE_BATTER_TECHNIQUE_POLICY_V1?{batterTechniqueV1:core.LIVE_BATTER_TECHNIQUE_POLICY_V1}:{}),batterObservationV151:core.LIVE_MATCH_BATTER_OBSERVATION_V2??core.AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:core.AUTHORED_MATCH_RANDOMNESS_V152,batterAutoDirectionPolicyV250:policy,batterNeutralReactivePolicyV272:neutral});
 }
 function summary(active){return active.batterAutoDirectionPolicyV250?{batterAutoDirectionPolicyV250:{...active.batterAutoDirectionPolicyV250},...(active.batterNeutralReactivePolicyV272?{batterNeutralReactivePolicyV272:{...active.batterNeutralReactivePolicyV272}}:{})}:{}}
 root.KneekuraMatchAutoDirectionV250=Object.freeze({forNextGame,summary});
})(globalThis);

