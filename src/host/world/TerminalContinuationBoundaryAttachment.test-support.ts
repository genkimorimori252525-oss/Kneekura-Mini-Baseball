import assert from 'node:assert/strict';
import {actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import type {AcceptedFoulTerminalApplication,DurableFoulTerminalAcknowledgedApplication} from './ActualFoulTerminalApplication';
import type {DurableFoulTerminalCompletedApplication} from './ActualFoulTerminalPostPlayCompletion';
import {actualFoulTerminalPostPlayBoundaryInput,type AcceptedFoulTerminalPostPlayBoundary} from './ActualFoulTerminalPostPlayBoundary';
import {openSqliteActualFoulTerminalApplicationStore} from './SqliteActualFoulTerminalApplicationStore';
import {openSqliteActualFoulTerminalApplicationRunner} from './SqliteActualFoulTerminalApplicationRunner';
import {openSqliteActualFoulTerminalScoringStore} from './SqliteActualFoulTerminalScoringStore';
import {openSqliteActualFoulTerminalRoleWorkloadStore,type AcceptedFoulTerminalWorkloadAuthority} from './SqliteActualFoulTerminalRoleWorkloadStore';
import {openSqlitePlayerPersonLinkStore} from './SqlitePlayerPersonLinkStore';
import {openSqlitePlayerWorkloadRecoveryStore,type AcceptedPlayerWorkloadBaseline} from './SqlitePlayerWorkloadRecoveryStore';
import type {SettledFoulAttachmentContext} from './ActualSettledFoulStopFixtures.test-support';

type BoundaryKind=AcceptedFoulTerminalPostPlayBoundary['kind'];
type Observe=(owner:'baseline'|'queue'|'official'|'acknowledgement'|'scoring'|'assessments'|'workload'|'completion',value:unknown)=>void;
/** Explicit baseline Sources only, through the unchanged independent owner.
 * No missing participant receives a generated calibration or effort default. */
export const initializeExplicitContinuationBaselines=(path:string,context:SettledFoulAttachmentContext,
 raw:readonly AcceptedPlayerWorkloadBaseline[],returned:Observe=()=>{})=>{
 const sources=cloneInert(raw);assert(new Set(sources.map(s=>s.sourceId)).size===sources.length&&new Set(sources.map(s=>json([s.careerId,s.playerId]))).size===sources.length,'continuation baseline Sources must be explicit and unique');
 const accepted=new Map(sources.map(s=>[s.sourceId,s])),links=context.track(openSqlitePlayerPersonLinkStore(path)),store=context.track(openSqlitePlayerWorkloadRecoveryStore(path,links,{readAcceptedBaseline:id=>accepted.get(id)??null,readAcceptedActivity:()=>null}));
 return sources.map(source=>{const value=store.initialize(source.sourceId);returned('baseline',value);return value;});
};
export type TerminalBoundaryAttachmentSources=Readonly<{
 kind:BoundaryKind;completionSourceId:string;
 workload:(acknowledged:DurableFoulTerminalAcknowledgedApplication)=>Readonly<{authority:AcceptedFoulTerminalWorkloadAuthority;assessmentSourceIds:readonly string[]}>;
 completion:(acknowledged:DurableFoulTerminalAcknowledgedApplication)=>AcceptedFoulTerminalPostPlayBoundary;
}>;
const completed=(value:DurableFoulTerminalCompletedApplication,inputs:TerminalBoundaryAttachmentSources)=>{
 const c=value.result.completion;assert(c.version==='actual_foul_terminal_post_play_completion_v2'&&c.kind===inputs.kind&&c.source.sourceId===inputs.completionSourceId,'terminal boundary attachment completed arm differs');
 if(inputs.kind==='game_final')assert(value.status==='POST_PLAY_COMPLETED_FINAL'&&!('activation'in c)&&!('nextWorld'in c),'final attachment created an activation');
 else assert(value.status==='POST_PLAY_COMPLETED_CONTINUING'&&'activation'in c&&'nextWorld'in c,'half attachment lacks its actual activation');
 return value;
};
/** One connected queue -> official -> acknowledgement -> scoring/TOTAL ->
 * boundary path. Production owners retain every fresh proof and repair fence;
 * test-level old-owner retries are left to one consolidated compatibility pass. */
export const attachTerminalBoundary=(path:string,context:SettledFoulAttachmentContext,rawTerminal:AcceptedFoulTerminalApplication,
 inputs:TerminalBoundaryAttachmentSources,returned:Observe=()=>{}):DurableFoulTerminalCompletedApplication=>{
 const terminal=cloneInert(rawTerminal);assert(inputs.kind==='half_change_continuing'||inputs.kind==='game_final','terminal boundary kind differs');
 const queue=context.track(openSqliteActualFoulTerminalApplicationStore(path,{readAcceptedApplication:id=>id===terminal.sourceId?terminal:null}));
 const queued=queue.enqueue(terminal.sourceId);returned('queue',queued);assert('status'in queued,'terminal queue prerequisites remain pending');
 if(queued.status==='POST_PLAY_COMPLETED_CONTINUING'||queued.status==='POST_PLAY_COMPLETED_FINAL')return completed(queued,inputs);
 let boundary:AcceptedFoulTerminalPostPlayBoundary|undefined;
 const runner=context.track(openSqliteActualFoulTerminalApplicationRunner(path,{readAcceptedPostPlaySetup:id=>boundary?.sourceId===id?boundary:null}));
 const applied=runner.apply(terminal.sourceId);returned('official',applied);
 if(applied.status==='POST_PLAY_COMPLETED_CONTINUING'||applied.status==='POST_PLAY_COMPLETED_FINAL')return completed(applied,inputs);
 const acknowledged=runner.acknowledge(terminal.sourceId);returned('acknowledgement',acknowledged);
 if(acknowledged.status!=='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY')return completed(acknowledged,inputs);
 const scoring=context.track(openSqliteActualFoulTerminalScoringStore(path));returned('scoring',scoring.apply(terminal.sourceId));
 const accepted=inputs.workload(acknowledged);assert(accepted.assessmentSourceIds.length===10&&new Set(accepted.assessmentSourceIds).size===10,'terminal requires ten explicit TOTAL assessment Sources');
 const links=context.track(openSqlitePlayerPersonLinkStore(path)),workload=context.track(openSqliteActualFoulTerminalRoleWorkloadStore(path,links,accepted.authority));
 returned('assessments',workload.acceptAssessments(accepted.assessmentSourceIds));const settlement=workload.settle(terminal.sourceId);returned('workload',settlement);assert(settlement.kind==='complete','terminal requires all ten actual TOTAL effects');
 boundary=actualFoulTerminalPostPlayBoundaryInput(inputs.completion(acknowledged),inputs.completionSourceId);assert(boundary.kind===inputs.kind,'accepted terminal boundary kind differs');
 const result=runner.completePostPlay(inputs.completionSourceId);returned('completion',result);return completed(result,inputs);
};
