import type { DatabaseSync } from 'node:sqlite';
import { renewalEnrollmentInput, renewalExactCut, assertRenewalCut, type RenewalEnrollmentSource } from './ActualReceivedUmpireRenewal';
import { actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireDefenderEnrollmentStore';
import { actualReceivedUmpireDefenderReplanEvidenceFromSqlite } from './SqliteActualReceivedUmpireDefenderReplanStore';
import { receivedJournal } from './ActualReceivedUmpireDefenderJournal';
import { receivedLegacyAdmissionPrefix } from './ActualReceivedUmpireDefenderEvidence';
import { actualLivePlayExtensionOpenState } from './ActualLivePlayFence';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const need=<T>(x:T|null|undefined,label:string):T=>{if(!x)throw new Error('received renewal original '+label+' missing');return x;};
const ref=(x:{source:{sourceId:string}})=>({sourceId:x.source.sourceId,sourceHash:hash(x.source),snapshotHash:hash(x)});
/** Historical derivation never asks any physical owner for current/latest.
 * Current write qualification is explicit and separate below. */
export const receivedRenewalEnrollmentEvidenceFromSqlite=(db:DatabaseSync)=>{
  const derive=(raw:RenewalEnrollmentSource)=>{
    const source=renewalEnrollmentInput(raw);
    return need(actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite(db).withOriginal(source.receivedEnrollmentSourceId,original=>{
      const enrollment=original.value,process=need(actualReceivedUmpireDefenderReplanEvidenceFromSqlite(db).read(source.receivedReplanSourceId),'received process');
      const r=process.replan,work=r.work[0],journal=receivedJournal(db,enrollment);
      if(process.source.enrollmentSourceId!==source.receivedEnrollmentSourceId||process.revision!==2||process.enrollmentHash!==hash(enrollment)
        ||journal.length!==4||journal[3].source_id!==source.receivedReplanSourceId||r.semantic!=='ready'||r.phase!=='renewal_due'
        ||!r.selected||!r.selectedAt||!r.scheduling||r.work.length!==1||work.kind!=='renewal_adoption'||work.sourceId!==process.originProcessSourceId
        ||json(work.cause)!==json(enrollment.cause))throw new Error('received renewal requires one exact ready received process');
      const cut=renewalExactCut(process.input.currentCut,process.input.ticksPerSecond);
      assertRenewalCut(cut,renewalExactCut(r.selectedAt,process.input.ticksPerSecond));
      assertRenewalCut(cut,renewalExactCut(enrollment.anchor.at,enrollment.anchor.ticksPerSecond));
      if(r.scheduling.movementStartTick!==cut.tick||work.dueTick!==cut.tick)throw new Error('received renewal is not at its exact selection and movement cut');
      const fields=battedWorldFieldEvidenceFromSqlite(db),baseField=need(fields.read(enrollment.anchor.baseField.sourceId),'base field');
      const prefix={baseField,fields:fields.scope(baseField,baseField.source.sourceId),executions:battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField,enrollment.anchor.execution.sourceId)};
      const execution=need(prefix.executions.at(-1),'physical predecessor');
      if(execution.source.sourceId!==enrollment.anchor.execution.sourceId||execution.revision!==enrollment.anchor.execution.revision)throw new Error('received renewal bounded predecessor differs');
      const world=baseField.response.touch.worldContact,batter=need(world.flight.physicalPitch.frame.batterActor,'batter actor');
      const bindings=[batter.binding,...batter.defenderBindings],ids=bindings.map(b=>b.playerId);
      if(ids.length!==10||new Set(ids).size!==10||bindings.some(binding=>{
        const actors=world.modelActorEvidence.filter(a=>a.binding.playerId===binding.playerId);
        return actors.length!==1||actors[0].binding.personId!==binding.personId||actors[0].binding.personLinkSourceId!==binding.personLinkSourceId
          ||actors[0].binding.gameId!==binding.gameId||actors[0].binding.gameDay!==binding.gameDay;
      }))throw new Error('received renewal ten participant Player/Person basis differs');
      const selves=actualPlayersKinematicsFromPrefix(ids,prefix),self=need(selves.find(s=>s.playerId===enrollment.source.playerId),'receiver self');
      for(const s of selves){assertRenewalCut(cut,renewalExactCut(s.at,s.ticksPerSecond));if(s.personId!==bindings.find(b=>b.playerId===s.playerId)?.personId||s.roles.length!==5||new Set(s.roles.map(p=>p.role)).size!==5)throw new Error('received renewal participant Person or role basis differs');}
      if(hash(self)!==enrollment.anchor.selfHash||hash(self.activeCommand)!==enrollment.anchor.activeCommandHash
        ||hash(self.ownedMotionCoverage?.roleAuthorities)!==enrollment.anchor.roleAuthoritiesHash)throw new Error('received renewal incumbent self or role authority differs');
      const motor=need(actualLocomotionEvidenceFromSqlite(db).read(enrollment.source.predecessorMotorSourceId),'incumbent motor');
      const model=need(playerLocomotionModelEvidenceFromSqlite(db).read(motor.source.locomotionModelSourceId),'locomotion model'),receiver=enrollment.receiver;
      if(model.source.playerId!==receiver.playerId||model.source.careerId!==receiver.careerId||model.source.personLinkSourceId!==receiver.personLinkSourceId
        ||model.source.fieldingModelSourceId!==receiver.fieldingModelSourceId||model.fieldingModel.person.personId!==receiver.personId
        ||model.source.acceptedAtDay>receiver.gameDay||hash(model.fieldingModel)!==enrollment.anchor.fieldingModelHash)throw new Error('received renewal accepted model identity differs');
      const value=freeze({source,gameId:enrollment.gameId,playId:enrollment.playId,physicalPitchSourceId:enrollment.source.physicalPitchSourceId,playerId:enrollment.source.playerId,
        runtimeSourceId:enrollment.source.runtimeSourceId,receivedEnrollmentSourceId:source.receivedEnrollmentSourceId,receivedReplanSourceId:source.receivedReplanSourceId,
        originProcessSourceId:process.originProcessSourceId,receiver,cause:enrollment.cause,cut,
        selection:{selected:r.selected,target:r.target,selectedAt:r.selectedAt,movementStartTick:r.scheduling.movementStartTick,dueTick:work.dueTick},
        anchor:{receivedEnrollment:ref(enrollment),receivedReplan:ref(process),legacyAdmissionPrefix:enrollment.anchor.legacyAdmissionPrefix,
          receivedJournal:{count:journal.length,digest:hash(journal)},baseField:enrollment.anchor.baseField,physicalPredecessor:enrollment.anchor.execution,
          observation:enrollment.anchor.observation,decision:enrollment.anchor.decision,motor:enrollment.anchor.motor,adoption:enrollment.anchor.adoption,
          locomotionModel:ref(model),decisionModel:enrollment.anchor.decisionModel,fieldingModelHash:enrollment.anchor.fieldingModelHash,selfHash:hash(self),
          participants:selves.map(s=>({playerId:s.playerId,personId:s.personId,selfHash:hash(s),activeCommandHash:hash(s.activeCommand),roleAuthoritiesHash:hash(s.ownedMotionCoverage?.roleAuthorities??s.roles.map(p=>({role:p.role,command:s.activeCommand,acceptedThroughTick:Math.min(p.canonicalActor.primitive.endTick,s.activeCommand.acceptedThroughTick)})))}))},
        membership:{version:'received_umpire_renewal_membership_v1' as const,effectiveFrom:cut,playerId:enrollment.source.playerId,legacyCoverage:'unchanged' as const,physicalAdvancement:'blocked' as const},
        pending:{kind:'renewal_decision' as const,originProcessSourceId:process.originProcessSourceId}});
      return {value,process,self,selves,model,baseField,execution,observation:original.observation};
    }),'received enrollment');
  };
  const qualifyNonPhysicalCurrent=(derived:ReturnType<typeof derive>)=>{
    const {value,baseField,observation}=derived;
    battedWorldFieldEvidenceFromSqlite(db).current(baseField);
    // The observation was authenticated immutably by derive(). Its current head
    // stays fixed while the separately qualified adoption advances physical ownership.
    const observed=db.prepare('SELECT * FROM actual_field_observation_heads WHERE (physical_pitch_source_id=? AND player_id=?) OR source_id=?').all(value.physicalPitchSourceId,value.playerId,observation.source.sourceId);
    if(observed.length!==1||observed[0].physical_pitch_source_id!==value.physicalPitchSourceId||observed[0].player_id!==value.playerId
      ||observed[0].source_id!==observation.source.sourceId||observed[0].revision!==observation.revision)throw new Error('received renewal current observation head differs');
    const h=db.prepare('SELECT * FROM actual_received_umpire_defender_replan_heads WHERE enrollment_source_id=?').get(value.receivedEnrollmentSourceId);
    const d=db.prepare('SELECT source_id,revision FROM actual_defensive_decision_heads WHERE physical_pitch_source_id=? AND player_id=?').get(value.physicalPitchSourceId,value.playerId);
    const prefix=receivedLegacyAdmissionPrefix(db,value.runtimeSourceId);
    if(!h||h.source_id!==value.receivedReplanSourceId||h.revision!==2||h.origin_process_source_id!==value.originProcessSourceId
      ||!d||d.source_id!==value.anchor.decision.sourceId||d.revision!==value.anchor.decision.revision
      ||prefix.length!==value.anchor.legacyAdmissionPrefix.count||hash(prefix)!==value.anchor.legacyAdmissionPrefix.digest)throw new Error('received renewal current owner or original prefix differs');
    return actualLivePlayExtensionOpenState(db,value);
  };
  const qualifyCurrent=(derived:ReturnType<typeof derive>)=>{
    battedWorldFieldExecutionEvidenceFromSqlite(db).current(derived.execution);
    actualFieldObservationEvidenceFromSqlite(db).current(derived.observation);
    return qualifyNonPhysicalCurrent(derived);
  };
  return {derive,qualifyCurrent,qualifyNonPhysicalCurrent};
};
export type DurableReceivedRenewalEnrollment=ReturnType<ReturnType<typeof receivedRenewalEnrollmentEvidenceFromSqlite>['derive']>['value'];
