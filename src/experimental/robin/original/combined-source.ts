import {findFirstSourceContactV94,findSourceStrikeZoneContactV94,type StrikeZoneVolumeV94} from '../../../core/sim/pitching/StrikeZoneVolumeV94';
import type {SourceFreeBallKernel} from '../../src/core/sim/ball/SourceFreeBallKernel';
import {createRobinLinearSourceV1} from './linear-source';import {createRobinFreeBallSuccessorShadowV1} from './free-ball-successor';
/** Diagnostic continuity only. Source collision proofStatus forbids match authority. */
export function createRobinCombinedShadowV1(input:Readonly<{version:'robin_combined_shadow_v1';source:ReturnType<typeof createRobinLinearSourceV1>;successor:ReturnType<typeof createRobinFreeBallSuccessorShadowV1>}>){
 if(input.version!=='robin_combined_shadow_v1'||input.successor.version!=='robin_free_ball_successor_shadow_v1'||input.successor.source!==input.source)throw Error('Robin combined HOLD: version');
 const source=input.source,successor=input.successor,cut=source.sampler.endSeconds,old=source.evaluateAt(cut,'incoming'),next=successor.kernel.evaluateAt(cut,'incoming');
 if(JSON.stringify(old.moment)!==JSON.stringify(next.moment)||JSON.stringify(old.orientation)!==JSON.stringify(next.materialOrientation))throw Error('Robin combined HOLD: discontinuous boundary');
 const cells=Object.freeze([...source.cells,...successor.kernel.cells]),boundaries=successor.kernel.boundaries;
 const evaluateAt=(t:number,side:'incoming'|'outgoing'='incoming')=>t<cut||t===cut&&side==='incoming'?source.evaluateAt(t,side):successor.kernel.evaluateAt(t,side);
 const visibleAt=(t:number)=>{evaluateAt(t);return source.sampler.hiddenAfterT===undefined||t<source.sampler.hiddenAfterT;};
 const shadow=Object.freeze({version:input.version,authority:'SHADOW_HOLD_PRIOR_CONTACT_UNPROVEN' as const,cut,cells,boundaries,evaluateAt,visibleAt});
 const view=shadow as unknown as SourceFreeBallKernel;
 const diagnosticContact=(gap:(t:number)=>number,colliderSpeed:number,through:number)=>{if(through<0||through>successor.kernel.descriptor.throughElapsedSeconds||!Number.isFinite(through))throw Error('Robin combined HOLD: horizon');return findFirstSourceContactV94(view,gap,colliderSpeed,through,true);};
 const diagnosticZone=(volume:StrikeZoneVolumeV94,radius:number,through:number)=>{if(through<0||through>successor.kernel.descriptor.throughElapsedSeconds||!Number.isFinite(through))throw Error('Robin combined HOLD: horizon');return findSourceStrikeZoneContactV94({kernel:view,volume,ballRadiusMeters:radius,throughElapsedSeconds:through});};
 const adjudicate=():never=>{throw Error('Robin combined HOLD: prior contact and numerical gap unproven');};
 return Object.freeze({...shadow,diagnosticContact,diagnosticZone,adjudicate});
}

