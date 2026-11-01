import type {SourceFreeBallKernel} from '../../src/core/sim/ball/SourceFreeBallKernel';
import {normalPitchContact} from '../bridge/normal-pitch-contact';

/** Conservative diagnostic admission: every declared physical path must be
 * clear through the observation, otherwise retain HOLD. A ground transition
 * is closed too, even where a later ground model might permit continuation. */
export function certifyLateObservationCutV1(input:{kernel:SourceFreeBallKernel;throughSeconds:number;colliders:readonly {id:string;gap:(t:number)=>number;speedBoundMps:number}[]}){
 const {kernel,throughSeconds,colliders}=input;
 if(!Number.isFinite(throughSeconds)||throughSeconds<0||!colliders.length||new Set(colliders.map(x=>x.id)).size!==colliders.length)throw Error('HOLD: invalid causal cut input');
 const ground=kernel.boundaries.find(x=>x.kind==='ground'&&x.elapsedSeconds<=throughSeconds);
 if(ground)return {version:'late_observation_cut_v1' as const,status:'HOLD' as const,reason:'GROUND_BEFORE_OBSERVATION' as const,at:ground.elapsedSeconds};
 for(const c of colliders){if(!Number.isFinite(c.speedBoundMps)||c.speedBoundMps<0)throw Error('HOLD: invalid collider speed bound');
  const hit=normalPitchContact(kernel,c.gap,c.speedBoundMps,throughSeconds);
  if(hit)return {version:'late_observation_cut_v1' as const,status:'HOLD' as const,reason:hit.kind==='hit'?'CONTACT_BEFORE_OBSERVATION' as const:'CONTACT_UNRESOLVED' as const,collider:c.id,hit};
 }
 return {version:'late_observation_cut_v1' as const,status:'CLEAR' as const,throughSeconds};
}
