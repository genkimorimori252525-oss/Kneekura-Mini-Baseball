import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';

export type ObservedDirectionMotorPolicyV153=Readonly<{version:'observed_direction_motor_v153';sourceId:string}>;
export const AUTHORED_OBSERVED_DIRECTION_MOTOR_V153:ObservedDirectionMotorPolicyV153=Object.freeze({
  version:'observed_direction_motor_v153',sourceId:'observed-direction-registration-v153'});
export function validateObservedDirectionMotorV153(raw:unknown):ObservedDirectionMotorPolicyV153 {
  const p=cloneInert(raw) as ObservedDirectionMotorPolicyV153;
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join('|')!=='sourceId|version'
    ||p.version!=='observed_direction_motor_v153'||typeof p.sourceId!=='string'||!p.sourceId.trim()||p.sourceId.length>200)
    throw Error('observed direction motor v153: invalid policy');
  return Object.freeze({version:p.version,sourceId:p.sourceId});
}

/** V151 velocity is at its forecast arrival. Move that derivative to the
 * perceived arrival, and anchor the model at the perceived position. A prior
 * supplies no derivative, so it cannot create this prediction on its own. */
export function createDirectionMotorPredictionV153(input:Readonly<{
  rawPrediction:Readonly<{position:Vec3;arrivalAfterReleaseSeconds:number;estimatedVelocity:Vec3;estimatedAcceleration:Vec3}>|null;
  perceivedPosition:Vec3;perceivedArrivalSeconds:number;originTick:number;ticksPerSecond:number;availableTick:number;
}>) {
  const raw=input.rawPrediction;if(!raw)return null;
  const dt=input.perceivedArrivalSeconds-raw.arrivalAfterReleaseSeconds;
  return {anchorTick:input.originTick+input.perceivedArrivalSeconds*input.ticksPerSecond,availableTick:input.availableTick,position:{...input.perceivedPosition},
    velocity:{x:raw.estimatedVelocity.x+raw.estimatedAcceleration.x*dt,y:raw.estimatedVelocity.y+raw.estimatedAcceleration.y*dt,
      z:raw.estimatedVelocity.z+raw.estimatedAcceleration.z*dt},acceleration:{...raw.estimatedAcceleration}};
}

/** Mechanical saturation after an error has happened. Slowing the whole
 * command preserves its spatial error and delays contact; it never retargets
 * the ball or reselects the nominal plan. No world/prediction enters here. */
export function limitDirectionExecutionV153(input:ReferenceBatKinematicsInputV1,limits:Readonly<{
  maximumSweetSpotSpeedMps?:number;maximumGripAccelerationMps2?:number;maximumAngularAccelerationRadPerSecond2?:number;
  maximumSweetSpotAccelerationMps2?:number;
}>) {
  if(input.aimCorrectionV121)throw Error('observed direction motor v153: saturation must precede late observation');
  const original=createReferenceBatKinematicsV1(input);
  let temporalScale=1;
  if(limits.maximumSweetSpotSpeedMps!==undefined)temporalScale=Math.min(temporalScale,limits.maximumSweetSpotSpeedMps/Math.max(original.maximumSweetSpotSpeedMps,Number.MIN_VALUE));
  for(const key of ['maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2'] as const)
    if(limits[key]!==undefined){const bound=original[key];if(bound===undefined)throw Error('observed direction motor v153: missing execution certificate');
      temporalScale=Math.min(temporalScale,Math.sqrt(limits[key]/Math.max(bound,Number.MIN_VALUE)));}
  const envelope=input.executionEnvelopeV133,holdStartTick=original.motionStartTickV133??input.startTick;
  if(temporalScale>=1)return {reference:input,temporalScale:1,holdStartTick};
  if(!envelope||!Number.isFinite(temporalScale)||temporalScale<=0)throw Error('observed direction motor v153: no finite constrained execution');
  temporalScale*=1-1e-8; // Leave room for the outward integer start-tick rounding.
  const startTick=Math.ceil(holdStartTick+(input.startTick-holdStartTick)/temporalScale),
    reference:ReferenceBatKinematicsInputV1={...input,startTick,playbackRate:input.playbackRate*temporalScale,
      ...(input.motorRampSecondsV121===undefined?{}:{motorRampSecondsV121:input.motorRampSecondsV121/temporalScale}),
      executionEnvelopeV133:{...envelope,preparation:{...envelope.preparation,durationSeconds:(startTick-holdStartTick)/input.ticksPerSecond},
        recovery:{...envelope.recovery,durationSeconds:envelope.recovery.durationSeconds/temporalScale}}},
    constrained=createReferenceBatKinematicsV1(reference);
  if(limits.maximumSweetSpotSpeedMps!==undefined&&constrained.maximumSweetSpotSpeedMps>limits.maximumSweetSpotSpeedMps)
    throw Error('observed direction motor v153: rounded execution exceeds speed limit');
  for(const key of ['maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2'] as const)
    if(limits[key]!==undefined&&(constrained[key]===undefined||constrained[key]!>limits[key]))throw Error('observed direction motor v153: rounded execution exceeds acceleration limit');
  return {reference,temporalScale,holdStartTick};
}
