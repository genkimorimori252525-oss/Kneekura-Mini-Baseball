import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaObservedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { readBattingEmotionGenesisFromSqlite } from './SqliteBattingEmotionStore';
import { readEmotionWorldRevisionFromSqlite,readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { assertCurrentObservedInitialPitchOperationFromSqlite,readHistoricalObservedInitialPitchOperationFromSqlite } from './SqliteObservedInitialPitchStore';
import { battingEmotionFrame,type AcceptedInitialBattingEmotionExecution,type DurableBattingEmotionExecution } from './NativeBattingEmotionExecution';
import { readAppraisalInput } from '../../core/world/psychology/appraisal/AppraisalValidation';
import { prepareEmotionExecution } from '../../core/world/psychology/execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../../core/world/psychology/execution/ExecutionAcceptance';

const fail=(message:string):never=>{throw new Error('initial batting emotion '+message);};
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))fail('original factual scope or frame differs');};
const pending=(reason:string,ids:readonly string[]=[])=>freeze({kind:'pending' as const,reason,missingSourceIds:ids});

/** Initial-pitch route to the SAME canonical emotion head/World CAS owner.
 * No fake continuation view, observation, TAKE or emotion acceptance exists. */
export function deriveInitialBattingEmotionExecutionFromSqlite(db:DatabaseSync,source:AcceptedInitialBattingEmotionExecution,current:boolean,
  previous:DurableBattingEmotionExecution|null){
  const operation=(current?assertCurrentObservedInitialPitchOperationFromSqlite:readHistoricalObservedInitialPitchOperationFromSqlite)(db,source.physicalOperationReference);
  const cut=operation.kind==='observed_initial_cut_v1'?operation:operation.cut;
  if(cut.stage!=='in_flight')return fail('requires current uncommitted in-flight cut');
  const {pitch,action}=readSamePaObservedPitchFromSqlite(db,source.physicalPitchReference),actor=pitch.originalActor;
  same(operation.source.launchReference,source.physicalPitchReference);same(operation.lineage,pitch.lineage);same(source.viewReference,action.source.viewReference);
  const view=readHistoricalSamePaExecutionView(db,source.viewReference).view;
  same(view.lineage,pitch.lineage);same(source.member,deriveSamePaDispatchRoles(actor,view)[0].member);
  const capture=readHistoricalObservedInitialPitchOperationFromSqlite(db,source.observationReference);
  const delivery=readHistoricalObservedInitialPitchOperationFromSqlite(db,source.deliveryReference);
  if(capture.kind!=='observed_initial_capture_v1'||delivery.kind!=='observed_initial_delivery_v1')return fail('original sensory owners differ');
  same(capture.lineage,pitch.lineage);same(delivery.lineage,pitch.lineage);same(delivery.captureReference,source.observationReference);same(delivery.captureHash,hash(capture));
  if(capture.operationOrdinal>operation.operationOrdinal||delivery.operationOrdinal>operation.operationOrdinal
    ||delivery.evaluationTick>cut.evaluationTick||delivery.delivery.kind!=='batting_observation_delivered')return fail('undelivered or future event');
  const genesis=readBattingEmotionGenesisFromSqlite(db,source.genesisReference.sourceId);
  if(!genesis)return pending('explicit_emotion_genesis_missing',[source.genesisReference.sourceId]);
  same(reference('batting_emotion_v1_geneses',genesis),source.genesisReference);same(genesis.source.member,source.member);
  same(genesis.scope,{careerId:actor.binding.careerId,matchId:actor.source.gameId,playerId:actor.binding.playerId});
  if(source.previousExecutionReference!==null&&!previous)return pending('previous_emotion_execution_missing',[source.previousExecutionReference.sourceId]);
  if(previous){same(reference('batting_emotion_execution_v1_executions',previous),source.previousExecutionReference);
    same(previous.source.genesisReference,source.genesisReference);same(previous.source.member.personHash,source.member.personHash);}
  const worldBefore=current?readEmotionWorldRevisionFromSqlite(db,actor.binding.careerId)
    :readHistoricalEmotionWorldRevisionFromSqlite(db,actor.binding.careerId,source.expectedWorld.worldRevision);
  if(!worldBefore)return pending('actual_world_control_head_missing');
  same(source.expectedWorld,{careerId:actor.binding.careerId,worldRevision:worldBefore.head.worldRevision,
    controlRevision:worldBefore.head.control.revision,controlHash:hash(worldBefore.head.control)});
  const beforeEmotion=previous?.acceptance.proposal.appraisal.state??genesis.state;
  const time={tick:cut.evaluationTick,sequence:operation.operationOrdinal},frame=battingEmotionFrame(source,actor,worldBefore,time),a=readAppraisalInput(source.appraisalAssessment);
  same(a.importance.scope,frame.scope);same(a.importance.time,frame.time);same(a.policy,beforeEmotion.policy);
  same(a.event.scope,frame.scope);same(a.evidenceEventIds,[delivery.source.sourceId]);
  if(a.importance.contextId!==frame.contextId||a.event.contextId!==frame.contextId||a.expectedRevision!==beforeEmotion.revision
    ||a.event.eventId!==delivery.source.sourceId||a.event.stamp.sourceId!==delivery.source.sourceId
    ||a.event.stamp.revision!==delivery.operationOrdinal||a.event.stamp.time.tick!==delivery.evaluationTick
    ||a.event.stamp.time.sequence!==delivery.operationOrdinal)return fail('appraisal is not the original delivered event');
  const clubId=actor.binding.clubId,game=actor.worldFixture.game,opponentClubId=clubId===game.homeClubId?game.awayClubId:game.homeClubId;
  if(a.importance.clubId!==clubId||a.importance.opponentClubId!==opponentClubId
    ||a.importance.competition.competitionId!==actor.binding.competitionEditionId||a.importance.competition.matchId!==actor.source.gameId
    ||a.importance.competition.careerId!==actor.binding.careerId)return fail('Career or competition binding differs');
  const request={executionId:source.executionId,frame,beforeEmotion,appraisal:a,baseline:{...source.baseline,frame},model:source.executionModel,runner:null};
  const proposal=prepareEmotionExecution(request);if(!proposal.ok)return fail('Core preparation rejected: '+proposal.reason.path);
  const accepted=acceptEmotionExecution(request,proposal.value);if(!accepted.ok)return fail('Core acceptance rejected: '+accepted.reason.path);
  return freeze({kind:'batting_emotion_execution' as const,source,lineage:pitch.lineage,physicalPitchSourceId:pitch.source.sourceId,
    physicalPitchReference:source.physicalPitchReference,worldBefore,acceptance:accepted.value});
}
