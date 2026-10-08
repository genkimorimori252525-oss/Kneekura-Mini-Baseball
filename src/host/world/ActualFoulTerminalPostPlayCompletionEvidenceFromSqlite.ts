import { assertFoulTerminalWorkloadStorage } from './ActualFoulTerminalRoleWorkloadStorage';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { activateNextNonLivePlateAppearance } from '../../core/adjudication/NonLiveOfficialApplication';
import { prepareBetweenPlayWorld } from '../../core/adjudication/BetweenPlayWorldReset';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {actualFoulTerminalPostPlayInput,type AcceptedFoulTerminalPostPlayInput} from './ActualFoulTerminalPostPlayBoundary';
import {deriveFoulTerminalIncomingDefenders} from './ActualFoulTerminalHalfChange';
import {deriveFoulTerminalFinalHistory} from './ActualFoulTerminalFinalHistory';
import {resolveOfficialGameProgression} from '../../core/world/competition/OfficialGameCompletion';
import type {FoulTerminalCompletion} from './ActualFoulTerminalPostPlayCompletion';
import type { FoulTerminalPostPlayCompletionPayload, FoulTerminalCompletionEvidence,
  FoulTerminalPostPlayCompletionEvidenceReader } from './ActualFoulTerminalPostPlayCompletion';
import { foulTerminalAcknowledgementAncestryFromSqlite } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { foulTerminalScoringEvidenceFromSqlite } from './ActualFoulTerminalScoringEvidenceFromSqlite';
import { foulTerminalWorkloadEvidenceFromSqlite } from './ActualFoulTerminalRoleWorkloadEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { foulTerminalPostPlaySetupIdentityRows } from './ActualFoulTerminalApplicationOwnership';
import { officialApplicationPostPlaySetupIdentityClaims } from '../OfficialApplicationOwnershipFromSqlite';
import { readFoulTerminalCompletionMirrors, validateFoulTerminalCompletionWire } from '../OfficialTerminalPostPlayCompletion';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { withFoulTerminalCompletionReader, withFoulTerminalOriginalScope } from './FoulTerminalCompletionAncestryGuard';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';

const same=(a:unknown,b:unknown,message:string)=>{if(json(a)!==json(b))throw new Error('terminal completion '+message);};
type Ancestry=NonNullable<ReturnType<ReturnType<typeof foulTerminalAcknowledgementAncestryFromSqlite>['read']>>;
const original=(value:Ancestry|null)=>{
  if(!value?.evidence||value.archiveStage!=='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY'&&value.archiveStage!=='POST_PLAY_COMPLETED_CONTINUING'&&value.archiveStage!=='POST_PLAY_COMPLETED_FINAL') {
    throw new Error('terminal completion requires authentic original acknowledgement');
  }
  return value.evidence;
};
const derive=(db:DatabaseSync,source:AcceptedFoulTerminalPostPlayInput,ancestry:Ancestry,current:boolean,archived?:FoulTerminalCompletion)=>{
  assertFoulTerminalWorkloadStorage(db);
  const saved=original(ancestry),p=saved.proposal;
  return withFoulTerminalOriginalScope(db,p.source.sourceId,p.gameId,p.playId,()=>{
    same(source.terminalReference,{owner:'actual_foul_terminal_applications',sourceId:p.source.sourceId,sourceVersion:p.source.sourceVersion,
      sourceHash:hash(p.source),proposalHash:hash(p)},'accepted original reference differs');
    const scoring=foulTerminalScoringEvidenceFromSqlite(db).prepare(p.source.sourceId);
    if(!scoring?.result)throw new Error('terminal completion scoring effect is missing');
    const settlement=foulTerminalWorkloadEvidenceFromSqlite(db).readSettlement(p.source.sourceId);
    if(settlement.kind!=='complete'||settlement.participants.length!==10||settlement.participants.some(a=>!a.applied)) {
      throw new Error('terminal completion requires all ten original TOTAL workload effects');
    }
    const actors=[...p.participants].sort((a,b)=>a.binding.playerId<b.binding.playerId?-1:a.binding.playerId>b.binding.playerId?1:0);
    same(settlement.participants.map(a=>[a.playerId,a.personId,a.clubId]),actors.map(a=>[a.binding.playerId,a.person.personId,a.binding.clubId]),'original workload membership differs');
    if(current)for(const [i,participant]of settlement.participants.entries()){
      const actor=actors[i],head=readActualRoleWorkloadState(db,settlement.careerId,participant.playerId,undefined,actor.binding.personLinkSourceId);
      if(!head||head.effectiveDay>settlement.gameDay||head.revision<participant.after.revision
        ||head.revision===participant.after.revision&&json(head)!==json(participant.after))throw new Error('terminal completion current participant workload differs');
    }
    const plan=db.prepare('SELECT plan_hash FROM main.actual_role_workload_settlements WHERE closure_source_id=?').get(p.source.sourceId);
    if(typeof plan?.plan_hash!=='string')throw new Error('terminal completion frozen workload plan missing');
    const row=db.prepare('SELECT source_hash,snapshot_hash,snapshot_json FROM main.actual_foul_play_ends WHERE source_id=?').get(p.physicalEndReference.sourceId);
    if(!row||typeof row.snapshot_json!=='string')throw new Error('terminal completion original physical end missing');
    const end=JSON.parse(row.snapshot_json) as Omit<FoulEndedEvidence,'wholeHistory'>;
    if(row.source_hash!==p.physicalEndReference.sourceHash||row.snapshot_hash!==p.physicalEndReference.snapshotHash
      ||row.snapshot_json!==json(end)||hash(end)!==row.snapshot_hash||end.kind!=='ended')throw new Error('terminal completion original physical end differs');
    const fieldOwner=battedWorldFieldEvidenceFromSqlite(db),executionOwner=battedWorldFieldExecutionEvidenceFromSqlite(db);
    const baseField=fieldOwner.read(end.source.baseFieldSourceId);
    if(!baseField)throw new Error('terminal completion original field cut is missing');
    const prefix={baseField,fields:fieldOwner.scope(baseField,end.source.baseFieldSourceId),executions:executionOwner.scope(baseField,end.source.executionSourceId)};
    if(prefix.executions.at(-1)?.source.sourceId!==end.source.executionSourceId)throw new Error('terminal completion original execution cut differs');
    const players=[...actualPlayersKinematicsFromPrefix(actors.map(a=>a.binding.playerId),prefix)].sort((a,b)=>a.playerId<b.playerId?-1:a.playerId>b.playerId?1:0);
    if(source.capability==='actual_foul_terminal_post_play_setup_v2'){
      const body=p.applicationBody,receipt=saved.result.official.receipt,atTick=source.kind==='game_final'?source.completedAtTick:source.nextStartedAtTick;
      if(!body.game||body.match.outs!==2||body.context.kind!=='strikeout'||Object.values(body.match.bases).some(v=>v!==null)
        ||atTick<p.clock.closureTick||atTick<end.exactEnd.tick)throw new Error('terminal boundary requires original third-out policy and post-closure time');
      const progression=resolveOfficialGameProgression({...body.game,gameId:p.gameId,priorMatch:body.match,application:receipt});
      same(progression,saved.result.official.pendingPostPlay.gameProgression,'original boundary progression differs');
      const retirement={kind:'rule_system_retire_original_play' as const,sourceId:source.sourceId,previousPlayId:p.playId,atTick,physicalEndReference:p.physicalEndReference,
        retired:players.map(a=>({playerId:a.playerId,personId:a.personId,activeCommand:a.activeCommand,ownedMotionCoverage:a.ownedMotionCoverage??null})),retainedOriginalFutureWork:end.futureWork};
      const common={version:'actual_foul_terminal_post_play_completion_v2' as const,completionId:json(['actual_foul_terminal_post_play_completion_v2',p.source.sourceId,source.sourceId]),source,sourceHash:hash(source),terminalReference:source.terminalReference,
        officialReference:{applicationId:receipt.applicationId,receiptHash:hash(receipt),pendingPostPlayHash:hash(saved.result.official.pendingPostPlay),acknowledgementHash:hash(saved.result.acknowledgement)},
        scoringReference:{scoringApplicationId:scoring.result.scoringApplicationId,rowHash:hash(scoring.row)},
        workloadReference:{terminalSourceId:p.source.sourceId,planHash:plan.plan_hash,participantEffects:settlement.participants.map(a=>({playerId:a.playerId,
          activitySourceId:a.activity.sourceEventId,beforeRevision:a.before.revision,afterRevision:a.after.revision,activityHash:hash(a.activity),afterHash:hash(a.after)}))}};
      let payload:unknown;
      if(source.kind==='game_final'){
        if(progression.kind!=='GAME_FINAL_PENDING_SCORING')throw new Error('terminal final Source cannot complete a continuing game');
        payload={...common,kind:source.kind,controllerRetirement:{...retirement,version:'actual_foul_terminal_controller_retirement_v2'},...deriveFoulTerminalFinalHistory(db,saved.result,p)};
      }else{
        if(progression.kind!=='GAME_CONTINUES')throw new Error('terminal half-change Source cannot activate a final game');
        const setup=source.worldSetup,geometry=battedWorldFieldGeometry(baseField);
        for(const base of ['first','second','third']as const)same(setup.baseCenters[base],geometry.baseGeometry.bases[base].region.center,'accepted venue base center differs');
        const incomingDefenders=deriveFoulTerminalIncomingDefenders(db,p,source,archived&&'incomingDefenders'in archived?archived.incomingDefenders:undefined);
        const activation=activateNextNonLivePlateAppearance({match:body.match,timeline:body.timeline,adjudication:body.adjudication,context:body.context,application:receipt,nextStartedAtTick:source.nextStartedAtTick});
        payload={...common,kind:source.kind,controllerRetirement:{...retirement,version:'actual_foul_terminal_controller_retirement_v1',nextPlayId:receipt.appliedMatchState.playId},
          incomingDefenders,activation,nextWorld:prepareBetweenPlayWorld(activation.nextMatchState,source.nextStartedAtTick,setup)};
      }
      const completion=validateFoulTerminalCompletionWire({...payload as object,snapshotHash:hash(payload)},p,saved.result);
      return freeze({original:saved,completion,settlement:{...settlement,kind:'complete' as const}});
    }
    const geometry=battedWorldFieldGeometry(baseField),setup=source.worldSetup;
    const defenders=actors.filter(a=>a.role==='defender');
    if(defenders.length!==9||setup.defenders.length!==9||setup.defenders.some(d=>!defenders.some(a=>a.binding.playerId===d.playerId&&a.registeredPosition===d.registeredPosition))) {
      throw new Error('terminal completion next defenders differ from original participants');
    }
    for(const base of ['first','second','third']as const)same(setup.baseCenters[base],geometry.baseGeometry.bases[base].region.center,'accepted venue base center differs');
    const body=p.applicationBody,receipt=saved.result.official.receipt;
    if(source.nextStartedAtTick<p.clock.closureTick||source.nextStartedAtTick<end.exactEnd.tick
      ||saved.result.official.pendingPostPlay.gameProgression.kind==='GAME_FINAL_PENDING_SCORING'
      ||body.match.inning!==receipt.appliedMatchState.inning||body.match.half!==receipt.appliedMatchState.half
      ||Object.values(body.match.bases).some(v=>v!==null)||Object.values(receipt.appliedMatchState.bases).some(v=>v!==null)) {
      throw new Error('terminal completion supports only same-half continuing empty bases after closure');
    }
    const retirement={version:'actual_foul_terminal_controller_retirement_v1' as const,kind:'rule_system_retire_original_play' as const,
      sourceId:source.sourceId,previousPlayId:p.playId,nextPlayId:receipt.appliedMatchState.playId,atTick:source.nextStartedAtTick,physicalEndReference:p.physicalEndReference,
      retired:players.map(a=>({playerId:a.playerId,personId:a.personId,activeCommand:a.activeCommand,ownedMotionCoverage:a.ownedMotionCoverage??null})),retainedOriginalFutureWork:end.futureWork};
    // Empty caller syntax is not retirement proof. The authentic physical-cut
    // derivation above must finish before the new world is constructed.
    if(setup.activePreviousPlayControllerIds.length)throw new Error('terminal completion original controllers were not retired');
    const activation=activateNextNonLivePlateAppearance({match:body.match,timeline:body.timeline,adjudication:body.adjudication,context:body.context,
      application:receipt,nextStartedAtTick:source.nextStartedAtTick});
    const nextWorld=prepareBetweenPlayWorld(activation.nextMatchState,source.nextStartedAtTick,setup);
    const payload:FoulTerminalPostPlayCompletionPayload={version:'actual_foul_terminal_post_play_completion_v1',
      completionId:json(['actual_foul_terminal_post_play_completion_v1',p.source.sourceId,source.sourceId]),source,sourceHash:hash(source),terminalReference:source.terminalReference,
      officialReference:{applicationId:receipt.applicationId,receiptHash:hash(receipt),pendingPostPlayHash:hash(saved.result.official.pendingPostPlay),acknowledgementHash:hash(saved.result.acknowledgement)},
      scoringReference:{scoringApplicationId:scoring.result.scoringApplicationId,rowHash:hash(scoring.row)},
      workloadReference:{terminalSourceId:p.source.sourceId,planHash:plan.plan_hash,participantEffects:settlement.participants.map(a=>({playerId:a.playerId,
        activitySourceId:a.activity.sourceEventId,beforeRevision:a.before.revision,afterRevision:a.after.revision,activityHash:hash(a.activity),afterHash:hash(a.after)}))},
      controllerRetirement:retirement,activation,nextWorld};
    const completion=validateFoulTerminalCompletionWire({...payload,snapshotHash:hash(payload)},p,saved.result);
    return freeze({original:saved,completion,settlement:{...settlement,kind:'complete' as const}});
  });
};
/** No opener or write method: all effect authentication uses this Native
 * connection and its bounded original physical read traversal. */
export const foulTerminalPostPlayCompletionEvidenceFromSqlite=(db:DatabaseSync)=>{
  const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if(!(db instanceof NativeDatabase))throw new Error('terminal completion evidence requires a Native connection');
  const snapshot=<T>(body:()=>T)=>withBattedVenueLegalReadSnapshot(db,()=>withBattedWorldPhysicalReadTraversal(db,body));
  const readWithEffects:FoulTerminalPostPlayCompletionEvidenceReader['readWithEffects']=sourceId=>withFoulTerminalCompletionReader(db,sourceId,()=>snapshot(()=>{
    const ancestry=foulTerminalAcknowledgementAncestryFromSqlite(db).read(sourceId);
    if(!ancestry)return null;
    if(ancestry.archiveStage!=='POST_PLAY_COMPLETED_CONTINUING'&&ancestry.archiveStage!=='POST_PLAY_COMPLETED_FINAL')throw new Error('terminal completion is still pending');
    const stored=readFoulTerminalCompletionMirrors(db,sourceId),derived=derive(db,stored.archive.result.completion.source,ancestry,false,stored.archive.result.completion);
    same(stored.archive.result.completion,derived.completion,'authenticated immutable effects differ');
    return freeze({archive:stored.archive,settlement:derived.settlement}) as FoulTerminalCompletionEvidence;
  }));
  return Object.freeze({read:(sourceId:string)=>readWithEffects(sourceId)?.archive??null,readWithEffects,
    prepare(raw:unknown){return snapshot(()=>{
      const candidate=cloneInert(raw) as AcceptedFoulTerminalPostPlayInput,source=actualFoulTerminalPostPlayInput(candidate,candidate?.sourceId);
      const terminal=foulTerminalPostPlaySetupIdentityRows(db,source.sourceId),official=officialApplicationPostPlaySetupIdentityClaims(db,source.sourceId);
      if(terminal.length||official.length)throw new Error('terminal completion accepted setup identity already has a durable claim');
      const ancestry=foulTerminalAcknowledgementAncestryFromSqlite(db).read(source.terminalReference.sourceId);
      if(!ancestry||ancestry.archiveStage!=='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY')throw new Error('fresh terminal completion requires acknowledged pending original');
      return derive(db,source,ancestry,true);
    });},
  });
};

export {deriveFoulTerminalIncomingDefenders,assertFoulTerminalIncomingDefendersCurrent} from './ActualFoulTerminalHalfChange';
export {deriveFoulTerminalFinalHistory} from './ActualFoulTerminalFinalHistory';
