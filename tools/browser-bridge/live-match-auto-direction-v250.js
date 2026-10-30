(function(root){
 'use strict';
 const policy=Object.freeze({version:'live_match_auto_direction_policy_v250',sourceId:'match-auto-direction-v250-ui'});
 function forNextGame(core,selection,embedded){
  if(selection!=='legacy'&&selection!=='observed')throw Error('match auto direction v250: invalid selection');
  if(selection==='legacy')return Object.freeze({});
  if(!core.AUTHORED_LIVE_BATTER_OBSERVATION_V151||!core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153)throw Error('match auto direction v250: required policies unavailable');
  return Object.freeze(embedded?{batterAutoDirectionPolicyV250:policy}:{batterObservationV151:core.AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,batterAutoDirectionPolicyV250:policy});
 }
 function summary(active){return active.batterAutoDirectionPolicyV250?{batterAutoDirectionPolicyV250:{...active.batterAutoDirectionPolicyV250}}:{}}
 root.KneekuraMatchAutoDirectionV250=Object.freeze({forNextGame,summary});
})(globalThis);
