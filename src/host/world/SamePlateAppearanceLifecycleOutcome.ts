import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import type { NonLiveOfficialContext } from '../../core/adjudication/NonLiveOfficialApplication';
import type { BallWorldSettledFoulDeadEvidenceInput } from '../../core/rules/BallWorldSettledFoulDeadEvidence';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { PlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLiveAdjudicationInput, type ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import type { SamePaLifecycleCut } from './SamePlateAppearanceLifecycle';
export type SamePaControllerCommand = Readonly<{sourceReference:SamePaReference;playerId:string;role:string;validThroughTick:number;originalCommandHash:string}> & (
  Readonly<{kind:'field_primitive';originalCommand:import('../../core/sim/ball/BallWorldContinuation').BallWorldMotionActor['primitive']}>
  | Readonly<{kind:'batting_motor';originalCommand:NonNullable<import('../../core/world/psychology/batting/BattingTypes').BattingCommitment['trajectory']>}>
  | Readonly<{kind:'pitch_delivery';originalCommand:ReturnType<typeof import('../../core/sim/pitch/CanonicalPitchDelivery').resolveCanonicalPitchDelivery>['timeline']}>);
export type SamePaControllerRetirementBasis = Readonly<{
  kind: 'same_pa_original_controller_retirement_basis_v1'; physicalPitchReference: SamePaReference; physicalOperationReference: SamePaReference;
  completedAtTick: number; completeCoverageHash: string;
  participants: readonly Readonly<{playerId:string;personId:string;ownedCommands:readonly SamePaControllerCommand[]}>[];
}>;
export type SamePaOriginalOfficialInstructions = Readonly<{
  assignment: Readonly<{sourceId:string;sourceVersion:string;gameId:string;playId:number;physicalPitchSourceId:string;officialIds:readonly string[];schedulerId:string}>;
  call: Readonly<{sourceId:string;sourceVersion:string;assignmentSourceId:string;officialId:string;judgment:'foul'|'count_result'}>;
  events: readonly Readonly<{sourceId:string;sourceVersion:string;schedulerId:string;kind:'advance_tick'|'next_pitch_fence'}>[];
}>;
type SamePaLifecycleOutcomeSourceBase = Readonly<{
  sourceId:string;sourceVersion:string;capability:'same_pa_lifecycle_outcome_v1';enrollmentReference:SamePaReference<'same_pa_enrollments'>;
  viewReference:SamePaReference<'pa_lifecycle_v1_execution_views'>;physicalOperationReference:SamePaLifecycleCut['physicalOperationReference'];
  officialPolicy:ActualLiveOfficialPolicy|null;
}>;
export type AcceptedSamePaLifecycleOutcome = SamePaLifecycleOutcomeSourceBase & (Readonly<{
  kind:'count_terminal'|'untouched_foul';rulePolicy:BallWorldSettledFoulDeadEvidenceInput['policy']|null;officialPolicy:ActualLiveOfficialPolicy|null;
  official:SamePaOriginalOfficialInstructions;
}> | Readonly<{kind:'fair_catch';rulePolicy:null;catchWorkReference:SamePaReference<'pa_catch_v1_work'>;
  official:import('./SamePlateAppearanceCatchOfficial').SamePaCatchOfficialScheduler}>);
export type SamePaLifecycleOutcome = Readonly<{
  kind:'same_pa_lifecycle_outcome';source:AcceptedSamePaLifecycleOutcome;lineage:SamePaExecutionLineage;actor:DurablePhysicalPlateAppearanceActor;
  disposition:'terminal'|'ordinary_foul';timeline:CanonicalPlateAppearanceTimeline;evaluationTick:number;physicalCompletedAtTick:number;
  physicalEnd:PlayEndFact|null;physicalProofHash:string;officialLedger:PlayAdjudicationLedger;context:NonLiveOfficialContext|null;
  controllerRetirementBasis:SamePaControllerRetirementBasis;baseCenters:BetweenPlayWorldSetup['baseCenters'];
  fairCatch?:import('./SamePlateAppearanceFairCatchEndFromSqlite').SamePaFairCatchPhysicalEnd;
}>;
export type AcceptedSamePaLifecycleReset = Readonly<{
  sourceId:string;sourceVersion:string;capability:'same_pa_lifecycle_reset_v1';enrollmentReference:SamePaReference<'same_pa_enrollments'>;
  viewReference:SamePaReference<'pa_lifecycle_v1_execution_views'>;outcomeReference:SamePaReference<'pa_lifecycle_v1_outcomes'>;
  controllerReset:'rule_system_retire_same_pa_episode_v1';nextStartedAtTick:number;worldSetup:BetweenPlayWorldSetup;
}>;
export type SamePaLifecycleReset = Readonly<{
  kind:'same_pa_lifecycle_reset';source:AcceptedSamePaLifecycleReset;lineage:SamePaExecutionLineage;timeline:CanonicalPlateAppearanceTimeline;
  resetWorld:CanonicalWorldSnapshot;retirement:Readonly<{kind:'same_pa_episode_controllers_retired_v1';atTick:number;basis:SamePaControllerRetirementBasis}>;
}>;
const tick=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const base=(s:AcceptedSamePaLifecycleOutcome|AcceptedSamePaLifecycleReset,extra:readonly string[])=>fields(s,['sourceId','sourceVersion','capability','enrollmentReference','viewReference',...extra])
  &&text(s.sourceId)&&text(s.sourceVersion)&&ref(s.enrollmentReference,'same_pa_enrollments')&&ref(s.viewReference,'pa_lifecycle_v1_execution_views');
export const samePaLifecycleOutcomeInput=(raw:unknown,id?:string):AcceptedSamePaLifecycleOutcome|AcceptedSamePaLifecycleReset=>{
  const s=cloneInert(raw) as AcceptedSamePaLifecycleOutcome|AcceptedSamePaLifecycleReset;if(!s||id!==undefined&&s.sourceId!==id)throw new Error('invalid lifecycle outcome Source identity');
  if(s.capability==='same_pa_lifecycle_reset_v1'){
    const w=s.worldSetup;if(!base(s,['outcomeReference','controllerReset','nextStartedAtTick','worldSetup'])||!ref(s.outcomeReference,'pa_lifecycle_v1_outcomes')
      ||s.controllerReset!=='rule_system_retire_same_pa_episode_v1'||!tick(s.nextStartedAtTick)||!fields(w,['baseCenters','defenders','activePreviousPlayControllerIds'])
      ||!fields(w.baseCenters,['first','second','third'])||Object.values(w.baseCenters).some(p=>!fields(p,['x','z'])||![p.x,p.z].every(Number.isFinite))
      ||!Array.isArray(w.defenders)||w.defenders.length!==9||w.defenders.some(d=>!fields(d,['playerId','registeredPosition','position'])||!text(d.playerId)||typeof d.registeredPosition!=='string'||!['P','C','1B','2B','3B','SS','LF','CF','RF'].includes(d.registeredPosition)
        ||!fields(d.position,['x','z'])||![d.position.x,d.position.z].every(Number.isFinite))||!Array.isArray(w.activePreviousPlayControllerIds)||w.activePreviousPlayControllerIds.length)throw new Error('invalid lifecycle reset Source');
    return freeze(s);
  }
  if(s.kind==='fair_catch'){
    if(s.capability!=='same_pa_lifecycle_outcome_v1'||!base(s,['physicalOperationReference','kind','rulePolicy','officialPolicy','official','catchWorkReference'])
      ||s.rulePolicy!==null||!ref(s.catchWorkReference,'pa_catch_v1_work')
      ||!['pa_physical_v1_field_roots','pa_physical_v1_field_steps'].some(owner=>ref(s.physicalOperationReference,owner)))throw new Error('invalid fair catch outcome Source');
    const o=s.official;if(!fields(o,['sourceId','sourceVersion','schedulerId','events'])||![o.sourceId,o.sourceVersion,o.schedulerId].every(text)
      ||!Array.isArray(o.events)||!o.events.length||o.events.some(e=>!fields(e,['sourceId','sourceVersion','schedulerId','kind'])
        ||![e.sourceId,e.sourceVersion,e.schedulerId].every(text)||typeof e.kind!=='string'||!['advance_tick','next_play_fence'].includes(e.kind))
      ||new Set([s.sourceId,o.sourceId,...o.events.map(e=>e.sourceId)]).size!==o.events.length+2)throw new Error('invalid fair catch official scheduler');
    actualLiveAdjudicationInput({sourceId:s.sourceId,sourceVersion:s.sourceVersion,physicalEndSourceId:s.sourceId,policy:s.officialPolicy},s.sourceId);
    return freeze(s);
  }
  if(s.capability!=='same_pa_lifecycle_outcome_v1'||!base(s,['physicalOperationReference','kind','rulePolicy','officialPolicy','official'])
    ||!['pa_take_successor_v1_pitch_actions','pa_physical_v1_resolutions','pa_physical_v1_field_roots','pa_physical_v1_field_steps'].some(owner=>ref(s.physicalOperationReference,owner))
    ||!['count_terminal','untouched_foul'].includes(s.kind)||s.kind==='count_terminal'&&s.rulePolicy!==null||s.kind==='untouched_foul'&&(!fields(s.rulePolicy,['version','ruleProfileId','rulesRevision'])
      ||s.rulePolicy?.version!=='untouched_settled_foul_dead_v1'||!text(s.rulePolicy.ruleProfileId)||!text(s.rulePolicy.rulesRevision)))throw new Error('invalid lifecycle outcome Source');
  actualLiveAdjudicationInput({sourceId:s.sourceId,sourceVersion:s.sourceVersion,physicalEndSourceId:s.sourceId,policy:s.officialPolicy},s.sourceId);
  const o=s.official,a=o?.assignment,c=o?.call;
  if(!fields(o,['assignment','call','events'])||!fields(a,['sourceId','sourceVersion','gameId','playId','physicalPitchSourceId','officialIds','schedulerId'])
    ||![a.sourceId,a.sourceVersion,a.gameId,a.physicalPitchSourceId,a.schedulerId].every(text)||!tick(a.playId)||!Array.isArray(a.officialIds)||!a.officialIds.length
    ||a.officialIds.some(x=>!text(x))||new Set(a.officialIds).size!==a.officialIds.length||!fields(c,['sourceId','sourceVersion','assignmentSourceId','officialId','judgment'])
    ||![c.sourceId,c.sourceVersion,c.assignmentSourceId,c.officialId].every(text)||!['foul','count_result'].includes(c.judgment)||!Array.isArray(o.events)||!o.events.length
    ||o.events.some(e=>!fields(e,['sourceId','sourceVersion','schedulerId','kind'])||![e.sourceId,e.sourceVersion,e.schedulerId].every(text)||typeof e.kind!=='string'||!['advance_tick','next_pitch_fence'].includes(e.kind))
    ||new Set([s.sourceId,a.sourceId,c.sourceId,...o.events.map(e=>e.sourceId)]).size!==o.events.length+3)throw new Error('invalid original official instructions');return freeze(s);
};
export type SamePaLifecycleOutcomeReader=(db:DatabaseSync,ref:SamePaReference<'pa_lifecycle_v1_outcomes'>)=>SamePaLifecycleOutcome;
