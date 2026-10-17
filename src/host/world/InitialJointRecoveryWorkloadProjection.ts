import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaHash as digest,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { initialJointCumulativeWorkloadAssessmentInput,projectInitialJointCumulativeWorkload,type AcceptedInitialJointWorkloadView } from './InitialJointWorkloadProjection';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';

export type AcceptedInitialJointRecoveryWorkloadView=Readonly<{
  sourceId:string;sourceVersion:string;capability:'initial_joint_recovery_cumulative_workload_view_v1';
  recoveryReference:SamePaReference<'pa_joint_recovery_v1_executions'>;coverageHash:string;
  assessment:AcceptedInitialJointWorkloadView['assessment'];participantTotals:AcceptedInitialJointWorkloadView['participantTotals'];
}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint recovery workload projection: '+message);}
export function initialJointRecoveryWorkloadViewInput(raw:unknown,id?:string):AcceptedInitialJointRecoveryWorkloadView{
  const s=cloneInert(raw) as AcceptedInitialJointRecoveryWorkloadView;
  assert(fields(s,['sourceId','sourceVersion','capability','recoveryReference','coverageHash','assessment','participantTotals'])
    &&text(s.sourceId)&&text(s.sourceVersion)&&(id===undefined||s.sourceId===id)&&s.capability==='initial_joint_recovery_cumulative_workload_view_v1'
    &&validRef(s.recoveryReference,'pa_joint_recovery_v1_executions')&&digest(s.coverageHash),'invalid identity or exact recovery coverage');
  initialJointCumulativeWorkloadAssessmentInput({sourceId:s.sourceId,coverageHash:s.coverageHash,assessment:s.assessment,participantTotals:s.participantTotals});
  return freeze(s);
}
/** Cumulative recovery work is evaluated from the original reservation once.
 * The preceding projection is a lower bound, not the next physiological input. */
export function projectInitialJointRecoveryWorkload(raw:AcceptedInitialJointRecoveryWorkloadView,basis:Readonly<{
  original:SamePaExecutionView;previous:ReturnType<typeof projectInitialJointCumulativeWorkload>;coverageHash:string;gameDay:number;
  activePlayerIds:readonly string[];advancedPlayerIds:readonly string[];
}>){
  const s=initialJointRecoveryWorkloadViewInput(raw),ids=basis.original.participants.map(p=>p.playerId);
  assert(basis.previous.participants.length===ids.length&&new Set(basis.previous.participants.map(p=>p.playerId)).size===ids.length
    &&basis.previous.participants.every(p=>ids.includes(p.playerId)),'previous participant extent differs');
  assert(basis.advancedPlayerIds.length>0&&new Set(basis.advancedPlayerIds).size===basis.advancedPlayerIds.length
    &&basis.advancedPlayerIds.every(id=>basis.activePlayerIds.includes(id)),'actual recovery participants required');
  for(const p of basis.previous.participants){
    const total=s.participantTotals.find(t=>t.participantReference.playerId===p.playerId),original=basis.original.participants.find(t=>t.playerId===p.playerId);
    assert(total&&original&&json(p.participantReference)===json(total.participantReference)&&json(p.reservedState)===json(original.reservedState),'previous identity or original reservation differs');
    assert(total.effortUnits>=p.effortUnits,'cumulative recovery work cannot erase previous TOTAL');
    assert(!basis.advancedPlayerIds.includes(p.playerId)||total.effortUnits>p.effortUnits,'actual recovery work requires an increased cumulative TOTAL');
  }
  return projectInitialJointCumulativeWorkload({sourceId:s.sourceId,coverageHash:s.coverageHash,assessment:s.assessment,participantTotals:s.participantTotals},basis);
}
