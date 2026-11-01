import {validateBaseballMaterialOrientationV1} from '../../../core/sim/ball/BaseballSeamForceV1';
import type {Quaternion} from '../../../core/sim/pitching/BaseballOrientation';
import {quaternionFromAxisAngle} from '../../../core/sim/pitching/BaseballOrientation';
type Vec=Readonly<{x:number;y:number;z:number}>;
/** Declared coordinate convention only; does not claim measured physical seams. */
export const robinOriginalPointToCoreV1=(p:Vec)=>({x:p.x,y:p.y-.23,z:p.z});
export function robinVisualSpinConventionV1(axis:Vec,rpm:number,elapsedSeconds:number,previousVisualState?:Readonly<{version:'captured_legacy_visual_quaternion_v1';captureSha256:string;orientation:Quaternion}>){
 const n=Math.hypot(axis.x,axis.y,axis.z);
 if(!Number.isFinite(n)||n<=1e-9||!Number.isFinite(rpm)||!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw Error('Robin visual convention HOLD');
 if(rpm===0){
  if(previousVisualState?.version!=='captured_legacy_visual_quaternion_v1'||!/^[a-f0-9]{64}$/.test(previousVisualState.captureSha256))throw Error('Robin visual convention HOLD: previous visual state missing');
  return Object.freeze({version:'robin_visual_preserved_state_v1' as const,authority:'CALLER_DECLARED_CAPTURE_NOT_MEASURED_MATERIAL' as const,origin:'PRIOR_VISUAL_STATE' as const,spin:{x:0,y:0,z:0},orientation:validateBaseballMaterialOrientationV1(previousVisualState.orientation),captureSha256:previousVisualState.captureSha256});
 }
 const omega=rpm*Math.PI*2/60,spin={x:axis.x/n*omega,y:axis.y/n*omega,z:axis.z/n*omega};
 return Object.freeze({version:'robin_visual_initial_identity_v1' as const,authority:'MODEL_CONVENTION_NOT_MEASURED_MATERIAL' as const,origin:'PITCH_RELEASE_ELAPSED_SECONDS' as const,spin,orientation:quaternionFromAxisAngle(axis,omega*elapsedSeconds)});
}

