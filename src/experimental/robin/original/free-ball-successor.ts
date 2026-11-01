import {createSourceFreeBallKernel,type SourceFreeBallDescriptorV2} from '../../../core/sim/ball/SourceFreeBallKernel';
import {validateBaseballMaterialOrientationV1} from '../../../core/sim/ball/BaseballSeamForceV1';
import {createRobinLinearSourceV1} from '../bridge/narrow-source';
import type {Quaternion} from '../../../core/sim/pitching/BaseballOrientation';
/** Shadow only: the caller must independently prove no earlier competing contact
 * and provide an actual terminal material orientation before any game authority. */
export function createRobinFreeBallSuccessorShadowV1(input:Readonly<{
 version:'robin_free_ball_successor_shadow_v1';source:ReturnType<typeof createRobinLinearSourceV1>;
 profile:SourceFreeBallDescriptorV2['profile'];throughElapsedSeconds:number;
 terminalMaterialOrientation:Quaternion|null;terminalOrientationEvidence:'DECLARED_SHADOW_ONLY';
}>){
 if(input.version!=='robin_free_ball_successor_shadow_v1'||input.terminalOrientationEvidence!=='DECLARED_SHADOW_ONLY'||input.terminalMaterialOrientation===null)throw Error('Robin successor HOLD: missing supported terminal orientation');
 const end=input.source.sampler.endSeconds;
 if(!Number.isFinite(input.throughElapsedSeconds)||input.throughElapsedSeconds<=end)throw Error('Robin successor HOLD: invalid horizon');
 const incoming=input.source.evaluateAt(end,'incoming'),moment=incoming.moment;
 if(input.profile.air.ticksPerSecond!==input.profile.ground.ticksPerSecond||moment.ball.position.y<=input.profile.ground.radiusM)throw Error('Robin successor HOLD: incompatible clock or floor');
 const orientation=validateBaseballMaterialOrientationV1(input.terminalMaterialOrientation);
 const kernel=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:moment,throughElapsedSeconds:input.throughElapsedSeconds,profile:input.profile,materialOrientationAtStart:orientation});
 const boundary=kernel.evaluateAt(end,'incoming');
 if(JSON.stringify(boundary.moment)!==JSON.stringify(moment)||JSON.stringify(boundary.materialOrientation)!==JSON.stringify(orientation))throw Error('Robin successor HOLD: boundary discontinuity');
 return Object.freeze({version:input.version,source:input.source,authority:'SHADOW_UNVERIFIED_CONTACTS_AND_ORIENTATION' as const,model:'CORE_FREE_BALL_AFTER_ORIGINAL_SOURCE' as const,boundaryVelocityBasis:'FINAL_POSITION_SEGMENT_INCOMING' as const,originalContactResponseVelocityBasis:'ONE_DT_BACKWARD_DIFFERENCE_SEPARATE' as const,boundary:moment,kernel});
}

