import { DeterministicRng } from '../../../rng/DeterministicRng';
import { resolveBallTransferTiming } from '../../../sim/fielding/BallTransferTiming';
import { createRatedThrowLaunch } from '../../../sim/fielding/ThrowLaunch';
import { fail, fraction, integer, list, obj, text } from '../EmotionValidation';
import { safeTickSum, cloneExecutionData } from '../execution/ExecutionValidation';
import type { ThrowSource, ThrowPhysicalPlan, FieldingStatus } from './FieldingTypes';
import { callCore, finite, positive, positiveTick, vec3 } from './FieldingPrimitives';

export function validateThrowSource(source:ThrowSource):void {
 const p='fielding.source';
 obj(source,['sourceId','revision','frame','observationTick','validUntilTick','kind','ballId','holderId','securedPossessionTick',
  'origin','holderVelocity','receiverId','target','armStrength','throwingAccuracy','transferAbility','transfer',
  'repertoireId','repertoireVersion','physicalSpeedCeilingMps','profiles','randomSeed'],p);
 text(source.ballId,p+'.ballId');if(source.holderId!==null)text(source.holderId,p+'.holderId');
 text(source.receiverId,p+'.receiverId');
 if(source.receiverId===source.frame.scope.playerId)fail('INVALID_INPUT',p+'.selfReceiverUnsupported');
 const secured=integer(source.securedPossessionTick,p+'.securedPossessionTick');
 if(secured>source.observationTick)fail('INVALID_INPUT',p+'.securedPossessionTick');
 const origin=vec3(source.origin,p+'.origin'),velocity=vec3(source.holderVelocity,p+'.holderVelocity');
 if(velocity.x!==0 || velocity.y!==0 || velocity.z!==0)fail('INVALID_INPUT',p+'.movingThrowRequiresBodyAdapter');
 const target=vec3(source.target,p+'.target');
 const distance=positive(Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z),p+'.targetDistance');
 if(distance<=1e-12)fail('INVALID_INPUT',p+'.targetDistance');
 for(const k of ['armStrength','throwingAccuracy','transferAbility'] as const)fraction(source[k],p+'.'+k);
 const transfer=obj(source.transfer,['minimumTransferDelayTicks','maximumTransferDelayTicks','fixedGripOffsetTicks'],p+'.transfer');
 for(const k of Object.keys(transfer))integer(transfer[k],p+'.transfer.'+k);
 if(source.transfer.minimumTransferDelayTicks>source.transfer.maximumTransferDelayTicks)fail('INVALID_INPUT',p+'.transfer.range');
 text(source.repertoireId,p+'.repertoireId');text(source.repertoireVersion,p+'.repertoireVersion');
 const ceiling=positive(source.physicalSpeedCeilingMps,p+'.physicalSpeedCeilingMps');
 const seed=integer(source.randomSeed,p+'.randomSeed');if(seed>0xffffffff)fail('INVALID_INPUT',p+'.randomSeed');
 const ids=new Set<string>();let previousThreshold=-1,previousMinimum=0,previousMaximum=0;
 const profiles=list(source.profiles,(raw,path)=>{
  const v=obj(raw,['profileId','minimumAggression','motorDurationTicks','calibration'],path);
  const id=text(v.profileId,path+'.profileId');if(ids.has(id))fail('INVALID_INPUT',path+'.profileId');ids.add(id);
  const threshold=fraction(v.minimumAggression,path+'.minimumAggression');
  if(threshold<=previousThreshold)fail('INVALID_INPUT',path+'.minimumAggression');previousThreshold=threshold;
  positiveTick(v.motorDurationTicks,path+'.motorDurationTicks');
  const c=obj(v.calibration,['minimumReleaseSpeedMps','maximumReleaseSpeedMps','minimumTargetErrorMeters','maximumTargetErrorMeters'],path+'.calibration');
  const low=positive(c.minimumReleaseSpeedMps,path+'.calibration.minimumReleaseSpeedMps');
  const high=positive(c.maximumReleaseSpeedMps,path+'.calibration.maximumReleaseSpeedMps');
  const minError=finite(c.minimumTargetErrorMeters,path+'.calibration.minimumTargetErrorMeters',0);
  const maxError=finite(c.maximumTargetErrorMeters,path+'.calibration.maximumTargetErrorMeters',0);
  if(high<low || high>ceiling || low<previousMinimum || high<previousMaximum || maxError<minError)
   fail('INVALID_INPUT',path+'.physicalEnvelope');
  previousMinimum=low;previousMaximum=high;return raw;
 },p+'.profiles');
 if(!profiles.length || source.profiles[0].minimumAggression!==0)fail('INVALID_INPUT',p+'.profiles.coverage');
}

export function planEmotionThrow(s:ThrowSource,commitmentTick:number,aggression:number):Readonly<{status:FieldingStatus;plan:ThrowPhysicalPlan|null}> {
 if(s.holderId!==s.frame.scope.playerId)return {status:'NO_CONTROL',plan:null};
 const selected=[...s.profiles].reverse().find(p=>p.minimumAggression<=aggression)!;
 const transfer=callCore('fielding.transfer',()=>resolveBallTransferTiming(s.securedPossessionTick,s.transferAbility,s.transfer));
 const motorStartTick=Math.max(commitmentTick,transfer.throwReadyTick);
 const releaseTick=safeTickSum(motorStartTick,selected.motorDurationTicks,'fielding.releaseTick');
 if(releaseTick>s.validUntilTick)return {status:'MISSED_WINDOW',plan:null};
 const launch=callCore('fielding.launch',()=>createRatedThrowLaunch({releaseTick,origin:s.origin,intendedTarget:s.target,
  armStrength:s.armStrength,throwingAccuracy:s.throwingAccuracy,calibration:selected.calibration,rng:new DeterministicRng(s.randomSeed)}));
 // Reject nonrepresentable Core arithmetic, rather than freezing an invalid numerical plan.
 cloneExecutionData(launch,'fielding.launch');
 const speed=Math.hypot(launch.initialVelocity.x,launch.initialVelocity.y,launch.initialVelocity.z);
 if(speed===0 || !Number.isFinite(speed) || Math.abs(speed/launch.releaseSpeedMps-1)>1e-10)
  fail('INVALID_INPUT','fielding.launch.unrepresentableVelocity');
 return {status:'READY',plan:{kind:'THROW',ballId:s.ballId,receiverId:s.receiverId,profileId:selected.profileId,
  commitmentTick,transfer,motorStartTick,launch}};
}
