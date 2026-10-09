import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodyCompositionSourceClaim as claim } from './BodyMaterializationSqliteOwnership';
import { batterRunArchiveFromSqlite,openBatterRunSourceArchive,type BatterRunArchiveOwner } from './BatterRunSourceArchive';
import { batterSwingExitStateInput as input,projectBatterSwingExitState,type AcceptedBatterSwingExitState as Source } from './BatterSwingExitState';
import { playerBatterRunTransitionModelEvidenceFromSqlite } from './SqlitePlayerBatterRunTransitionModelStore';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const table='world_batter_swing_exit_states' as const;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('batter swing-exit original physical binding differs');};
const zero=(v:{x:number;y:number;z:number})=>v.x===0&&v.y===0&&v.z===0;
const derive=(db:DatabaseSync,source:Source)=>withSamePaLifecycleReadPhase(db,()=>{
  const proof=readSamePaPhysicalOperationFromSqlite(db,source.fieldReference),field=proof.record;
  if(field.kind!=='same_pa_physical_field_root_v1'&&field.kind!=='same_pa_physical_field_step_v1')throw new Error('batter swing-exit requires an owned field cut');
  const root=field.kind==='same_pa_physical_field_root_v1'?field:readSamePaPhysicalOperationFromSqlite(db,field.source.fieldRootReference).record;
  if(root.kind!=='same_pa_physical_field_root_v1'||root.physicalPitchSourceId!==field.physicalPitchSourceId)throw new Error('batter swing-exit original field root missing');
  const posture=readBattingPerceptionFromSqlite(db,'posture',root.source.postureReference),actor=proof.actor;
  if(posture.kind!=='batting_invocation_posture'||posture.physicalPitchSourceId!==field.physicalPitchSourceId)throw new Error('batter swing-exit original posture missing');
  same(posture.lineage,proof.lineage);
  const body=posture.model.bodyMaterialization,playerId=actor.binding.playerId;
  if(body.source.playerId!==playerId||body.person.personId!==actor.binding.personId||body.person.sourceId!==actor.binding.personLinkSourceId)
    throw new Error('batter swing-exit original Player/Person body differs');
  const model=playerBatterRunTransitionModelEvidenceFromSqlite(db).read(source.transitionModelReference.sourceId);
  if(!model)throw new Error('batter swing-exit accepted recovery model missing');
  same(source.transitionModelReference,reference('world_player_batter_run_transition_models',model));
  if(model.source.playerId!==playerId||model.source.careerId!==actor.binding.careerId||model.source.personLinkSourceId!==actor.binding.personLinkSourceId
    ||model.source.acceptedAtDay>actor.binding.gameDay||model.source.parameters.ticksPerSecond!==root.source.parameters.ticksPerSecond)
    throw new Error('batter swing-exit recovery model scope, day or clock differs');
  same(model.runnerModel.person,body.person);
  const command=root.source.commands.filter(c=>c.playerId===playerId),shape=body.actor.primitives.filter(p=>p.role==='body');
  const primitives=field.field.motion.actors.filter(p=>p.playerId===playerId&&p.primitive.role==='body');
  if(command.length!==1||shape.length!==1||primitives.length!==1||command[0].primitiveMotions.some(p=>!zero(p.offsetVelocity)||!zero(p.offsetAcceleration)))
    throw new Error('batter swing-exit body decomposition needs the original static pose');
  const moment=field.field.motion.world.moment,at={originTick:moment.originTick,elapsedSeconds:moment.elapsedSeconds,tick:moment.ball.tick};
  if(at.tick!==field.evaluationTick)throw new Error('batter swing-exit field endpoint differs');
  const physical=projectBatterSwingExitState({at,contactTick:root.response.world.flight.contact.tick,ticksPerSecond:root.source.parameters.ticksPerSecond,
    bodyPrimitive:primitives[0].primitive,...(primitives[0].startElapsedSeconds===undefined?{}:{startElapsedSeconds:primitives[0].startElapsedSeconds}),bodyOffset:shape[0].offset,bodyForwardUnit:source.bodyForwardUnit});
  return freeze({kind:'owned_batter_swing_exit_state_v1' as const,source,lineage:proof.lineage,playerId,personId:body.person.personId,
    gameDay:actor.binding.gameDay,physicalPitchReference:proof.physicalPitchReference,bodyMaterializationReference:reference('world_player_body_materializations',body),
    at,...physical,model,body:body.actor,firstBaseCenter:root.geometry.baseGeometry.bases.first.region.center,motionIssued:false as const});
});
export type DurableBatterSwingExitState=ReturnType<typeof derive>;
const make=(db:DatabaseSync):BatterRunArchiveOwner<Source,DurableBatterSwingExitState>=>({input,derive:s=>derive(db,s),
  key:s=>json([s.fieldReference.owner,s.fieldReference.sourceId]),
  scope:s=>({sql:`${claim('source_json',['fieldReference','sourceId'])} OR ${claim('snapshot_json',['source','fieldReference','sourceId'])}`,
    values:[s.fieldReference.sourceId,s.fieldReference.sourceId]}),
});
export const batterSwingExitStateEvidenceFromSqlite=(db:DatabaseSync)=>batterRunArchiveFromSqlite(db,table,make(db));
export const openSqliteBatterSwingExitStateStore=(path:string,authority?:Readonly<{readAcceptedState(id:string):Source|null}>)=>
  openBatterRunSourceArchive(path,table,make,authority?.readAcceptedState.bind(authority));
