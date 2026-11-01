import {robinGlobalSpeedBoundV1} from '../original/speed-bound';
import {findFirstSourceContactV94,findSourceStrikeZoneContactV94,type StrikeZoneVolumeV94} from '../../../core/sim/pitching/StrikeZoneVolumeV94';
import type {SourceFreeBallKernel} from '../../src/core/sim/ball/SourceFreeBallKernel';
import {createRobinPathSamplerV1} from './narrow-sampler';
import {quantizeEventTick} from '../../../core/sim/ExactEventTime';
import {IDENTITY_QUATERNION} from '../../../core/sim/pitching/BaseballOrientation';
type Vec=Readonly<{x:number;y:number;z:number}>;
type Input=Readonly<{version:'robin_original_linear_source_v1';originTick:number;ticksPerSecond:number;path:Readonly<{dt:number;points:readonly Vec[];hiddenAfterT?:number}>;legacyVelocityPath?:Readonly<{dt:number;points:readonly Vec[];hiddenAfterT?:number}>;spin:Vec}>;
/** Research adapter only. First-contact/zone would use cells, boundaries and evaluateAt;
 * no aerodynamic descriptor or other API compatibility is claimed. */
export function createRobinLinearSourceV1(input:Input){
 if(input.version!=='robin_original_linear_source_v1'||!Number.isSafeInteger(input.originTick)||!Number.isSafeInteger(input.ticksPerSecond)||input.ticksPerSecond<=0||![input.spin.x,input.spin.y,input.spin.z].every(Number.isFinite))throw Error('unsupported Robin Source');
 const sampler=createRobinPathSamplerV1(input.path),spin=Object.freeze({...input.spin}),speedBound=robinGlobalSpeedBoundV1(input.path.points,input.path.dt);
 if(input.legacyVelocityPath&&(input.legacyVelocityPath.dt!==input.path.dt||input.legacyVelocityPath.points.length!==input.path.points.length||input.legacyVelocityPath.points.some((p,i)=>p.x!==input.path.points[i].x||p.y-.23!==input.path.points[i].y||p.z!==input.path.points[i].z)))throw Error('Robin Source HOLD: legacy velocity path differs');
 const legacySampler=input.legacyVelocityPath?createRobinPathSamplerV1(input.legacyVelocityPath):sampler;
 const cells=sampler.segments.map(s=>Object.freeze({fromElapsedSeconds:s.fromSeconds,throughElapsedSeconds:s.throughSeconds,maximumPositionSpeedMps:speedBound,positionRoundingBoundMeters:1e-8}));
 const evaluateAt=(seconds:number,side:'incoming'|'outgoing'='incoming')=>{const s=sampler.sample(seconds),velocity=side==='incoming'?s.velocityIncoming??s.velocityOutgoing:s.velocityOutgoing??s.velocityIncoming;
  return {moment:{originTick:input.originTick,elapsedSeconds:seconds,ball:{tick:quantizeEventTick(input.originTick,seconds,input.ticksPerSecond),position:s.position,velocity:velocity!,spin}},orientation:IDENTITY_QUATERNION,phase:'airborne' as const};};
 const source=Object.freeze({version:input.version,originTick:input.originTick,ticksPerSecond:input.ticksPerSecond,legacyVelocityAt:legacySampler.originalBackwardVelocity,legacyVelocityBasis:input.legacyVelocityPath?'CAPTURED_ORIGINAL_POINTS' as const:'SOURCE_POINTS_ONLY' as const,cells:Object.freeze(cells),boundaries:Object.freeze([]),evaluateAt,sampler});
 // Until a justified 2E interpolation/cell-selection bound exists, even the
 // opt-in path cannot be admitted to Core collision or zone decisions.
 const hold=():never=>{throw Error('Robin Source HOLD: interpolation and cell-selection error bound unproven');};
 const view=source as unknown as SourceFreeBallKernel;
 const diagnosticContact=(gap:(seconds:number)=>number,colliderSpeed:number,through:number)=>{
   if(!Number.isFinite(through)||through<0||through>sampler.endSeconds)throw Error('Robin Source HOLD: invalid horizon');
   return findFirstSourceContactV94(view,gap,colliderSpeed,through,true);
 };
 const diagnosticZone=(volume:StrikeZoneVolumeV94,radius:number,through:number)=>{
   if(!Number.isFinite(through)||through<0||through>sampler.endSeconds)throw Error('Robin Source HOLD: invalid horizon');
   return findSourceStrikeZoneContactV94({kernel:view,volume,ballRadiusMeters:radius,throughElapsedSeconds:through});
 };
 return Object.freeze({...source,proofStatus:'HOLD_UNPROVEN_GAP_ROUNDING' as const,findContact:hold,findZone:hold,diagnosticContact,diagnosticZone});
}







