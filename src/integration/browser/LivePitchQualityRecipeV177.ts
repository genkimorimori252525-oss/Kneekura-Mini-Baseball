import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { validateBaseballSeamForceV1, type BaseballSeamForceV1 } from '../../core/sim/ball/BaseballSeamForceV1';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../core/sim/pitching/BaseballOrientation';
import { validatePitchSnapshotV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';
import { resolveLivePitchReleasePlanV168, type LivePitchReleasePlanV168 } from './LivePitchReleasePlanV168';

export type LivePitchQualityRequestV177 = Readonly<{
  version:'live_pitch_quality_request_v177'; qualityState:LivePitchReleasePlanV168['qualityState'];
}>;
type InapplicableReasonV177 = 'MATERIAL_ORIENTATION_NOT_AUTHORED' | 'EFFECTIVE_SEAM_NOT_ACTIVE' | 'ZERO_SPIN'
  | 'ZERO_RELATIVE_AIR_SPEED' | 'TRANSVERSE_SPIN_BASIS_DEGENERATE' | 'MATERIAL_PHASE_AXIS_BELOW_NUMERIC_RESOLUTION';
const choices = {
  KIRE_CIRCLE:{spinScale:.04,materialPhaseDegrees:225},
  KIRE_DOUBLE_CIRCLE:{spinScale:.02,materialPhaseDegrees:0},
  THREATENING_DOUBLE_CIRCLE:{spinScale:.1,materialPhaseDegrees:270},
} as const;
const axes=['x','y','z'] as const;
function assert(value:unknown,message:string):asserts value {
  if(!value)throw Error('live pitch quality recipe: '+message);
}
function fields(raw:unknown,required:readonly string[],optional:readonly string[]=[]):asserts raw is Record<string,unknown> {
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&required.every(key=>Object.hasOwn(raw,key))
    &&Object.keys(raw).every(key=>required.includes(key)||optional.includes(key)),'unknown or missing fields');
}
function vector(raw:unknown):Vec3 {
  fields(raw,axes);assert(axes.every(key=>typeof raw[key]==='number'&&Number.isFinite(raw[key])),'finite velocity vector required');
  return raw as unknown as Vec3;
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z,
  scale=(v:Vec3,k:number):Vec3=>({x:v.x*k,y:v.y*k,z:v.z*k});

export function validateLivePitchQualityRequestV177(raw:unknown):LivePitchQualityRequestV177 {
  const request=cloneInert(raw);fields(request,['version','qualityState']);
  assert(request.version==='live_pitch_quality_request_v177'&&typeof request.qualityState==='string'
    &&Object.hasOwn(choices,request.qualityState),'unknown version or quality state');
  return Object.freeze({version:'live_pitch_quality_request_v177',qualityState:request.qualityState as LivePitchQualityRequestV177['qualityState']});
}

/** Authors nominal spin/material from a known pre-release command reference.
 * It neither runs a flight nor changes a force profile, saved base or result.
 * V176 establishes only the original right-handed prototype's time ordering. */
export function createLivePitchQualityReleasePlanV177(raw:Readonly<{
  selected:PitchSnapshotV78; request:LivePitchQualityRequestV177; referenceReleaseVelocity:Vec3;
  windVelocityMps:Vec3; throws:'R'|'L'; effectiveSeamForce?:BaseballSeamForceV1; maximumPitchSpeedMps?:number;
}>) {
  const input=cloneInert(raw);fields(input,['selected','request','referenceReleaseVelocity','windVelocityMps','throws'],
    ['effectiveSeamForce','maximumPitchSpeedMps']);
  const selected=validatePitchSnapshotV78(input.selected,input.maximumPitchSpeedMps),
    request=validateLivePitchQualityRequestV177(input.request),referenceReleaseVelocity=vector(input.referenceReleaseVelocity),
    windVelocityMps=vector(input.windVelocityMps),
    effectiveSeamForce=Object.hasOwn(input,'effectiveSeamForce')?validateBaseballSeamForceV1(input.effectiveSeamForce):undefined;
  assert(input.throws==='R'||input.throws==='L','explicit handedness required');
  const notApplicable=(reason:InapplicableReasonV177)=>Object.freeze({status:'NOT_APPLICABLE' as const,reason,
    pitchId:selected.pitchId,qualityState:request.qualityState,recipeVersion:'kire_release_recipe_v177' as const});
  if(selected.releaseOrientation===undefined)return notApplicable('MATERIAL_ORIENTATION_NOT_AUTHORED');
  if(effectiveSeamForce===undefined||effectiveSeamForce.coefficientScale===0)return notApplicable('EFFECTIVE_SEAM_NOT_ACTIVE');
  const spin=selected.spinRadPerSecond,spinMagnitude=norm(spin),
    relativeAir=vector({x:referenceReleaseVelocity.x-windVelocityMps.x,y:referenceReleaseVelocity.y-windVelocityMps.y,
      z:referenceReleaseVelocity.z-windVelocityMps.z}),airMagnitude=norm(relativeAir);
  assert(Number.isFinite(airMagnitude),'relative air magnitude must remain finite');
  if(spinMagnitude===0)return notApplicable('ZERO_SPIN');
  if(airMagnitude===0)return notApplicable('ZERO_RELATIVE_AIR_SPEED');
  const airUnit=vector(scale(relativeAir,1/airMagnitude)),along=dot(spin,airUnit),
    transverse=vector({x:spin.x-airUnit.x*along,y:spin.y-airUnit.y*along,z:spin.z-airUnit.z*along}),
    transverseMagnitude=norm(transverse);
  // Same relative basis threshold as the measured V162 construction.
  if(transverseMagnitude<=1e-12*spinMagnitude)return notApplicable('TRANSVERSE_SPIN_BASIS_DEGENERATE');
  const transverseUnit=vector(scale(transverse,1/transverseMagnitude)),
    {spinScale,materialPhaseDegrees}=choices[request.qualityState],gyroDegrees=30 as const,
    gyroLongitudinalSign=input.throws==='L'?-1 as const:1 as const,radians=gyroDegrees*Math.PI/180,
    axis=vector({x:transverseUnit.x*Math.cos(radians)+airUnit.x*Math.sin(radians)*gyroLongitudinalSign,
      y:transverseUnit.y*Math.cos(radians)+airUnit.y*Math.sin(radians)*gyroLongitudinalSign,
      z:transverseUnit.z*Math.cos(radians)+airUnit.z*Math.sin(radians)*gyroLongitudinalSign}),
    chosenSpin=vector(scale(axis,spinMagnitude*spinScale));
  // quaternionFromAxisAngle already rejects nonzero rotations at this bound.
  if(materialPhaseDegrees!==0&&norm(chosenSpin)<=1e-12)return notApplicable('MATERIAL_PHASE_AXIS_BELOW_NUMERIC_RESOLUTION');
  const releaseOrientation=materialPhaseDegrees===0?selected.releaseOrientation:
    normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(chosenSpin,materialPhaseDegrees*Math.PI/180),selected.releaseOrientation)),
    plan:LivePitchReleasePlanV168={version:'live_pitch_release_plan_v168',pitchId:selected.pitchId,qualityState:request.qualityState,
      expectedBase:{releaseSpeedMps:selected.releaseSpeedMps,spinRadPerSecond:selected.spinRadPerSecond,
        ...(Object.hasOwn(selected,'releaseOrientation')?{releaseOrientation:selected.releaseOrientation}:{}),
        ...(Object.hasOwn(selected,'seamForce')?{seamForce:selected.seamForce}:{})},
      nominal:{spinRadPerSecond:chosenSpin,releaseOrientation}};
  resolveLivePitchReleasePlanV168({selected,request:plan,
    ...(input.maximumPitchSpeedMps===undefined?{}:{maximumPitchSpeedMps:input.maximumPitchSpeedMps})});
  return freeze({status:'APPLIED' as const,plan,recipe:{version:'kire_release_recipe_v177' as const,
    qualityState:request.qualityState,spinScale,gyroDegrees,materialPhaseDegrees,gyroLongitudinalSign,
    referenceReleaseVelocity:{...referenceReleaseVelocity},windVelocityMps:{...windVelocityMps},
    authority:'LOCAL_AUTHORING_V176_MODEL_INPUTS_NOT_EMPIRICAL_OR_MASTERY' as const}});
}
