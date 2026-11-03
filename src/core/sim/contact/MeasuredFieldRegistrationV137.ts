import type {Vec3} from '../../model/geometry';
import type {Quaternion} from '../pitching/BaseballOrientation';

type MeasuredFrame=Readonly<{tick:number;grip:Vec3;orientation:Quaternion}>;

/** Same field registration previously owned by the Browser adapter. Source
 * measurements stay unchanged. M is a basis reflection, not a side swap or a
 * proper rotation of a performer; angular velocity therefore uses det(M)M. */
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
/** Callers validate their original points/axes before applying this basis. */
export const registerMeasuredPositionToFieldV137=(p:Vec3):Vec3=>({x:-p.x,y:p.y,z:p.z});
export const registerMeasuredAxialToFieldV137=(w:Vec3):Vec3=>({x:w.x,y:-w.y,z:-w.z});
export const registerMeasuredOrientationToFieldV137=(q:Quaternion):Quaternion=>({w:q.w,x:q.x,y:-q.y,z:-q.z});

export function registerMeasuredBatToFieldV1(frames:readonly MeasuredFrame[]):readonly MeasuredFrame[]{
  if(!Array.isArray(frames)||frames.length<2||frames.some(f=>!Number.isSafeInteger(f.tick)||f.tick<0
    ||!f.grip||!f.orientation||!Object.values(f.grip).every(Number.isFinite)||!Object.values(f.orientation).every(Number.isFinite)))
    throw new Error('measured bat field registration requires finite original frames');
  return frames.map(f=>({tick:f.tick,grip:registerMeasuredPositionToFieldV137(f.grip),orientation:registerMeasuredOrientationToFieldV137(f.orientation)}));
}
