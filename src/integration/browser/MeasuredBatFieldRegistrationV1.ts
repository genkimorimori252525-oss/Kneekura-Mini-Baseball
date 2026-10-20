import type { Vec3 } from '../../core/model/geometry';
import type { Quaternion } from '../../core/sim/pitching/BaseballOrientation';

type MeasuredFrame=Readonly<{tick:number;grip:Vec3;orientation:Quaternion}>;

/** The preserved research file stores (labY,labZ,labX). OBP +labY points
 * toward the RIGHT-handed box, whereas this game's +fieldX points toward 1B.
 * The field registration must therefore put that box on the negative-X 3B
 * side. This is one basis conversion for BOTH recorded sides, not replacing
 * a left-handed measurement with a right-handed trajectory. */
export const MEASURED_BAT_FIELD_REGISTRATION_V1=Object.freeze({
  authority:'OBP_ORIGINAL_LAB_TO_FIRST_BASE_POSITIVE_X_FIELD_V1' as const,
  rawMeasuredArtifactUnchanged:true as const,
  storedPositionToField:'(-x,y,z)' as const,
  originalLabPositionToField:'(-labY,labZ,labX)' as const,
  quaternionToField:'(w,x,-y,-z)' as const,
  linearVelocityToField:'(-vx,vy,vz)' as const,
  angularVelocityToField:'(wx,-wy,-wz); axial vector det(M)*M' as const,
  rightHandedBox:'THIRD_BASE_NEGATIVE_X' as const,
  leftHandedBox:'FIRST_BASE_POSITIVE_X' as const,
});

export function registerMeasuredBatToFieldV1(frames:readonly MeasuredFrame[]):readonly MeasuredFrame[]{
  if(!Array.isArray(frames)||frames.length<2||frames.some(f=>!Number.isSafeInteger(f.tick)||f.tick<0
    ||!f.grip||!f.orientation||!Object.values(f.grip).every(Number.isFinite)||!Object.values(f.orientation).every(Number.isFinite)))
    throw new Error('measured bat field registration requires finite original frames');
  // A reflection cannot itself be encoded by a quaternion. Conjugating the
  // original rotation R by M=diag(-1,1,1) gives the proper rotation M*R*M.
  // The local bat axis is +Y, so M leaves that local axis unchanged. Thus
  // q'=(w,x,-y,-z) reflects grip, tip and sweet spot together. ReferenceBat
  // derives omega' = det(M)*M*omega and v'=M*v from these same original keys.
  return frames.map(f=>({tick:f.tick,grip:{x:-f.grip.x,y:f.grip.y,z:f.grip.z},
    orientation:{w:f.orientation.w,x:f.orientation.x,y:-f.orientation.y,z:-f.orientation.z}}));
}
