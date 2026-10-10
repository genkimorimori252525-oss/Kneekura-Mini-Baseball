import { createRequire } from 'node:module';
import { expect,it,vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const seam=vi.hoisted(()=>({state:undefined as unknown}));
const state=()=>seam.state as ReturnType<typeof build>;
// These seams stand in for already authenticated original owners. The new
// enrollment's selection/binding/cut/prefix composition is the real derivation.
vi.mock('./SqliteActualReceivedUmpireDefenderEnrollmentStore',()=>({actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite:()=>({withOriginal:(_id:string,consume:(v:unknown)=>unknown)=>consume({value:state().enrollment,observation:state().observation})})}));
vi.mock('./SqliteActualReceivedUmpireDefenderReplanStore',()=>({actualReceivedUmpireDefenderReplanEvidenceFromSqlite:()=>({read:()=>state().process,deriveCurrent:()=>{throw new Error('FORBIDDEN_CURRENT_REPLAN');}})}));
vi.mock('./ActualReceivedUmpireDefenderJournal',()=>({receivedJournal:()=>state().journal}));
vi.mock('./SqliteBattedWorldFieldStore',()=>({battedWorldFieldEvidenceFromSqlite:()=>({read:()=>state().baseField,scope:(_base:unknown,through:string)=>{if(through!=='field-a')throw new Error('UNBOUNDED_FIELD_SCOPE');return [state().baseField];},current:()=>{state().currentCalls++;}})}));
vi.mock('./SqliteBattedWorldFieldExecutionStore',()=>({battedWorldFieldExecutionEvidenceFromSqlite:()=>({scope:(_base:unknown,through:string)=>{if(through!=='execution-a')throw new Error('UNBOUNDED_EXECUTION_SCOPE');state().boundedReads++;return [state().execution];},current:()=>{state().currentCalls++;}})}));
vi.mock('./ActualPlayerKinematicsFromPrefix',()=>({actualPlayersKinematicsFromPrefix:(ids:string[])=>ids.map(id=>state().selves.find(s=>s.playerId===id))}));
vi.mock('./SqliteActualLocomotionStore',()=>({actualLocomotionEvidenceFromSqlite:()=>({read:()=>state().motor})}));
vi.mock('./SqlitePlayerLocomotionModelStore',()=>({playerLocomotionModelEvidenceFromSqlite:()=>({read:()=>state().model})}));
import { receivedRenewalEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireRenewalEvidence';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const source={sourceId:'renewal-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_enrollment_v1' as const,receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2'};
const build=()=>{
  const at={originTick:1000,elapsedSeconds:0.2,tick:1200},roles=['glove','body','tag_hand','left_foot','right_foot'];
  const ids=['batter','player-a',...Array.from({length:8},(_,i)=>'defender-'+i)];
  const binding=(playerId:string)=>({playerId,personId:'person-'+playerId,personLinkSourceId:'link-'+playerId,gameId:'game-a',gameDay:10});
  const bindings=ids.map(binding),fieldingModel={source:{sourceId:'fielding-a'},person:{personId:'person-player-a'}};
  const model={source:{sourceId:'model-a',playerId:'player-a',careerId:'career-a',personLinkSourceId:'link-player-a',fieldingModelSourceId:'fielding-a',acceptedAtDay:10},fieldingModel};
  const selves=ids.map(playerId=>({playerId,personId:'person-'+playerId,at:{...at},ticksPerSecond:1000,roles:roles.map(role=>({role})),activeCommand:{sourceId:'incumbent-'+playerId},ownedMotionCoverage:{roleAuthorities:roles.map(role=>({role,acceptedThroughTick:2200}))}}));
  const self=selves[1],ref=(sourceId:string)=>({sourceId,sourceHash:hash(sourceId),snapshotHash:hash(['snapshot',sourceId])});
  const enrollment={source:{sourceId:'received-a',physicalPitchSourceId:'pitch-a',playerId:'player-a',runtimeSourceId:'runtime-a',predecessorMotorSourceId:'old-motor'},gameId:'game-a',playId:1,
    cause:{physicalPitchSourceId:'pitch-a',playerId:'player-a',callSourceId:'call-a',originCommunicationSourceId:'send-a'},receiver:{careerId:'career-a',playerId:'player-a',personId:'person-player-a',personLinkSourceId:'link-player-a',fieldingModelSourceId:'fielding-a',gameDay:10},
    anchor:{at:{...at},ticksPerSecond:1000,baseField:ref('field-a'),execution:{...ref('execution-a'),revision:10},observation:{...ref('observation-a'),revision:3},legacyAdmissionPrefix:{count:24,digest:'legacy'},decision:{...ref('old-decision'),revision:1},motor:ref('old-motor'),adoption:ref('old-adoption'),decisionModel:ref('decision-model'),fieldingModelHash:hash(fieldingModel),selfHash:hash(self),activeCommandHash:hash(self.activeCommand),roleAuthoritiesHash:hash(self.ownedMotionCoverage.roleAuthorities)}};
  const process={source:{sourceId:'replan-2',enrollmentSourceId:'received-a'},revision:2,enrollmentHash:hash(enrollment),originProcessSourceId:'replan-1',input:{currentCut:{...at},ticksPerSecond:1000},replan:{semantic:'ready',phase:'renewal_due',selected:{intent:{kind:'ball_handler'}},target:{x:1,z:2},selectedAt:{...at},scheduling:{movementStartTick:1200},work:[{kind:'renewal_adoption',sourceId:'replan-1',cause:enrollment.cause,dueTick:1200}]}};
  const frame={batterActor:{binding:bindings[0],defenderBindings:bindings.slice(1)}};
  const worldContact={modelActorEvidence:[...bindings,...Array.from({length:8},(_,i)=>binding('off-play-'+i))].map(b=>({binding:{...b}})),flight:{physicalPitch:{frame}}};
  const baseField={source:{sourceId:'field-a'},response:{touch:{worldContact}}};
  return {baseField,enrollment,process,selves,model,motor:{source:{sourceId:'old-motor',locomotionModelSourceId:'model-a'}},observation:{source:{sourceId:'observation-a'}},execution:{source:{sourceId:'execution-a'},revision:10},journal:[{source_id:'received-a'},{source_id:'replan-1'},{source_id:'policy-a'},{source_id:'replan-2'}],currentCalls:0,boundedReads:0};
};
const fixture=()=>{seam.state=build();const db=new DatabaseSync(':memory:');db.exec('BEGIN');return {db,reader:receivedRenewalEnrollmentEvidenceFromSqlite(db),close(){db.exec('ROLLBACK');db.close();}};};
it('RV01 derives ten original participants from an eighteen-entry model catalog without current reads',()=>{
  const f=fixture();try{let result:ReturnType<typeof f.reader.derive>|undefined;
    expect(()=>{result=f.reader.derive(source);},'FULL_MODEL_CATALOG_CONFUSED_WITH_PARTICIPANTS').not.toThrow();
    expect(result!.value.anchor.participants.map(p=>p.playerId)).toEqual(state().selves.map(s=>s.playerId));expect(state().currentCalls).toBe(0);expect(state().boundedReads).toBe(1);
  }finally{f.close();}
});
it('RV02 rejects a participant whose original model Person binding differs',()=>{
  const f=fixture();try{state().baseField.response.touch.worldContact.modelActorEvidence[1].binding.personId='foreign-person';expect(()=>f.reader.derive(source)).toThrow(/participant|Player|Person|basis/);}finally{f.close();}
});
it('RV03 rejects a selected instant that shares the current tick but differs in elapsed time',()=>{
  const f=fixture();try{state().process.replan.selectedAt.elapsedSeconds=0.1999;expect(()=>f.reader.derive(source)).toThrow(/integer cut|tuple/);}finally{f.close();}
});
it('RV04 rejects a rebound accepted locomotion model despite a ready received process',()=>{
  const f=fixture();try{state().model.source.personLinkSourceId='foreign-link';expect(()=>f.reader.derive(source)).toThrow(/model identity/);}finally{f.close();}
});
