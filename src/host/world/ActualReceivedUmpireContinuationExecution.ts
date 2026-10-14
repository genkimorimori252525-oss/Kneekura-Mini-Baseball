import type { DatabaseSync } from 'node:sqlite';
import { advanceBattedWorldFieldMotionCheckpoint,type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { ownedMotionKnownWorkFromSqlite,type OwnedMotionKnownWork } from './OwnedMotionKnownWorkFromSqlite';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import { pendingOwnedScheduledPlan } from './OwnedScheduledMotionExecution';
import { receivedContinuationInput,receivedContinuationBound,type ReceivedContinuationSource } from './ActualReceivedUmpireContinuation';
import { renewalExactCut,assertRenewalCut,type RenewalCut } from './ActualReceivedUmpireRenewal';
import { actorFreeze as freeze,actorJson as json,actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
/** Original reference set is already authenticated by the bounded predecessor.
 * Current head discovery is a separate admission proof, never replay authority. */
export const receivedContinuationKnownWork=(prefix:readonly DurableBattedWorldFieldExecution[]):readonly OwnedMotionKnownWork[]=>{
  const prior=[...prefix].reverse().find(p=>p.source.action.kind==='owned_motion_v1'||p.source.action.kind==='owned_motion_v2');
  if(!prior||(prior.source.action.kind!=='owned_motion_v1'&&prior.source.action.kind!=='owned_motion_v2'))throw new Error('received continuation original known-work basis missing');
  return prior.source.action.knownWork;
};
export const assertReceivedContinuationCurrentKnownWork=(db:DatabaseSync,value:DurableBattedWorldFieldExecution)=>{
  if(value.execution.kind!=='received_renewal_continuation_v1')throw new Error('received continuation kind differs');
  const c=value.execution,pitch=value.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId;
  const ids=c.knownWork.map(w=>w.playerId);
  if(json(ownedMotionKnownWorkFromSqlite(db,pitch,ids))!==json(c.knownWork.map(({playerId,decisionSourceId,motorSourceId})=>({playerId,decisionSourceId,motorSourceId}))))throw new Error('received continuation known-work heads changed');
};
export type ReceivedContinuationExecution=Readonly<{kind:'received_renewal_continuation_v1';field:BattedWorldFieldMotion;
  renewalEnrollmentSourceId:string;renewalAdoptionSourceId:string;adoptionHash:string;playerId:string;originProcessSourceId:string;
  at:RenewalCut;executedThrough:RenewalCut;coverageThroughTick:number;checkpointThroughTick:number;
  knownWork:readonly (OwnedMotionKnownWork&Readonly<{decisionHash:string|null;dueTick:number|null}>)[];
  status:'physical_boundary'|'coverage_exhausted'|'decision_boundary';liveWork:Readonly<{kind:'physical_boundary'|'command_renewal'|'decision_revision';sourceId:string;dueTick:number}>}>;
export const deriveReceivedContinuationExecution=(db:DatabaseSync,raw:ReceivedContinuationSource,base:DurableBattedWorldFieldAction,prefix:readonly DurableBattedWorldFieldExecution[]):ReceivedContinuationExecution=>{
  const source=receivedContinuationInput(raw),prior=prefix.at(-1);
  if(!prior||prior.source.sourceId!==source.previousExecutionSourceId||prior.execution.kind!=='received_renewal_adoption_v1'
    ||prior.execution.adoption.renewalEnrollmentSourceId!==source.action.renewalEnrollmentSourceId||pendingOwnedScheduledPlan(prefix))throw new Error('received continuation requires its exact adopted predecessor without pending operation');
  const a=prior.execution,c=a.composition,state=ownedScheduledMotionActualState(base.field,prefix),world=base.response.touch.worldContact,batter=world.flight.physicalPitch.frame.batterActor!;
  const ids=[batter.binding.playerId,...batter.defenderBindings.map(b=>b.playerId)],pitch=world.flight.source.physicalPitchSourceId,tps=world.flight.source.execution.ballFlightParameters.ticksPerSecond;
  const at=renewalExactCut({originTick:state.moment.originTick,elapsedSeconds:state.moment.elapsedSeconds,tick:state.moment.ball.tick},tps);
  assertRenewalCut(at,renewalExactCut(c.at,c.ticksPerSecond));assertRenewalCut(at,renewalExactCut(a.adoption.executedThrough,a.adoption.ticksPerSecond));
  if(!state.cursor||ids.length!==10||new Set(ids).size!==10||c.contributors.length!==10||state.actors.length!==50
    ||ids.some(id=>c.contributors.filter(p=>p.playerId===id).length!==1)||state.actors.some(p=>p.primitive.endTick!==c.coverageThroughTick)
    ||json(state.actors)!==json(a.field.motion.actors))throw new Error('received continuation actual actor coverage differs');
  const refs=receivedContinuationKnownWork(prefix);
  if(refs.length!==10||ids.some(id=>refs.filter(w=>w.playerId===id).length!==1))throw new Error('received continuation known-work Player scope differs');
  const adopted=prefix.flatMap(v=>v.execution.kind==='owned_motion_v1'||v.execution.kind==='owned_motion_v2'?v.execution.adoption.contributors:[]);
  const decisions=actualDefensiveDecisionEvidenceFromSqlite(db);
  const knownWork=refs.map(w=>{
    const d=w.decisionSourceId===null?null:decisions.read(w.decisionSourceId);
    if(w.decisionSourceId!==null&&(!d||d.source.playerId!==w.playerId||d.source.physicalPitchSourceId!==pitch)
      ||w.motorSourceId!==null&&(!d||!adopted.some(a=>a.playerId===w.playerId&&a.motorSourceId===w.motorSourceId)))throw new Error('received continuation original decision or motor adoption differs');
    const r=d?.receipt;
    if(r&&(r.observedThrough.originTick!==at.originTick||r.observedThrough.elapsedSeconds>at.elapsedSeconds))throw new Error('received continuation decision is from a future cut');
    if(r?.lifecycle.status==='issued'&&!adopted.some(a=>a.playerId===w.playerId&&a.motorSourceId===w.motorSourceId))throw new Error('received continuation issued work lacks adoption');
    const dueTick=r?.lifecycle.status==='pending_decision'?r.scheduling.decisionTick:r?.lifecycle.status==='pending_first_step'?r.scheduling.movementStartTick:null;
    return {...w,decisionHash:d?hash(d):null,dueTick};
  });
  const checkpointThroughTick=receivedContinuationBound(at,c.coverageThroughTick,knownWork.map(w=>w.dueTick));
  const field=advanceBattedWorldFieldMotionCheckpoint({response:battedWorldResponseInput(base.response),geometry:battedWorldFieldGeometry(base),actors:state.actors,
    cursor:state.cursor,carrierPlayerId:state.carrierPlayerId,checkpointThroughTick});
  const end=field.motion.world.moment,executedThrough={originTick:end.originTick,elapsedSeconds:end.elapsedSeconds,tick:end.ball.tick,ticksPerSecond:tps};
  if(end.originTick!==at.originTick||end.elapsedSeconds<=at.elapsedSeconds||end.elapsedSeconds>(checkpointThroughTick-at.originTick)/tps
    ||json(field.motion.actors)!==json(state.actors)||field.motion.carrierPlayerId!==state.carrierPlayerId)throw new Error('received continuation physical progress or retained curves differ');
  const status=field.motion.world.kind==='boundary'?'physical_boundary' as const:checkpointThroughTick===c.coverageThroughTick?'coverage_exhausted' as const:'decision_boundary' as const;
  return freeze({kind:source.action.kind,field,renewalEnrollmentSourceId:source.action.renewalEnrollmentSourceId,renewalAdoptionSourceId:prior.source.sourceId,
    adoptionHash:hash(prior.source),playerId:a.adoption.playerId,originProcessSourceId:a.liveWork.originProcessSourceId,at,executedThrough,
    coverageThroughTick:c.coverageThroughTick,checkpointThroughTick,knownWork,status,
    liveWork:{kind:status==='physical_boundary'?'physical_boundary':status==='coverage_exhausted'?'command_renewal':'decision_revision',sourceId:source.sourceId,dueTick:end.ball.tick}});
};
