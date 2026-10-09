import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { actorHash as hash,actorJson as json,readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { proveSamePaExecution,samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { readPlayerPitchTimingPrefixFromSqlite,assertCurrentPlayerPitchTimingPrefixFromSqlite,selectPlayerPitchTimingProfileFromSqlitePrefix } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryPrefixFromSqlite,assertCurrentPlayerReleaseGeometryPrefixFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { rawCensus,schemaCensus,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { writeExecutionViewArtifact } from './SamePlateAppearanceExecutionViewGate.test-support';
import { classifyFieldModelNamespace } from './SamePlateAppearanceModelNamespace.test-support';
import { nominalClaim } from './DispatchNominalSqliteOwnership';
type FileRef=Readonly<{path:string;sha256:string}>;
type Qualified=Readonly<{version:'same_pa_execution_view_qualified_input_v1';qualified:true;artifact:FileRef;qualification:Readonly<Record<string,FileRef>>;viewReference:SamePaReference<'reserved_pa_execution_views'>;view:SamePaExecutionView}>;
type Input=Readonly<{version:'same_pa_model_inventory_input_v1';qualifiedViewManifest:FileRef;sourceCheckpoint:FileRef;fixtureOnly:true}>;
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const pinned=<T>(ref:FileRef):T=>{const bytes=readFileSync(ref.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);return JSON.parse(bytes.toString('utf8')) as T;};
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'inventory artifact has sidecar '+suffix);};
/** One read-only normal-owner inventory. No Source values, tables, baselines,
 * calibrations or admission rights are created. Missing model errors are matched
 * only at their unchanged normal owner's explicit absence boundary. */
export const verifyGenuineSamePaModelInventory=(input:Readonly<{inputPath:string;inputSha256:string;destinationPath:string}>)=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'bounded private controller required');
  const packet=pinned<Input>({path:input.inputPath,sha256:input.inputSha256});assert.equal(packet.version,'same_pa_model_inventory_input_v1');assert.equal(packet.fixtureOnly,true);
  const checkpoint=pinned<{qualifiedSource:boolean;source:{src:string}}>(packet.sourceCheckpoint);assert.equal(checkpoint.qualifiedSource,true);assert.equal(checkpoint.source.src,'6610c673102e94799fe29d572586f0ea630a2a99');
  const q=pinned<Qualified>(packet.qualifiedViewManifest);assert.equal(q.version,'same_pa_execution_view_qualified_input_v1');assert.equal(q.qualified,true);
  for(const f of Object.values(q.qualification))assert.equal(fileHash(f.path),f.sha256);
  const prior=pinned<{destinationPath:string;destinationSha256:string;view:SamePaExecutionView;viewReference:unknown;closedHandles:boolean;closedSidecars:boolean;executionViewQualified:boolean}>(q.qualification.receipt);
  same(q.artifact,{path:prior.destinationPath,sha256:prior.destinationSha256});same(q.view,prior.view);same(q.viewReference,prior.viewReference);
  assert(prior.closedHandles&&prior.closedSidecars&&prior.executionViewQualified);
  const terminal=pinned<{status:string;originalChildExit:number;failures:unknown[];remainingOwnedProcesses:unknown[];tests:{passedCases:number;reportSha256:string}}>(q.qualification.nativeTerminal);
  assert.equal(terminal.status,'passed');assert.equal(terminal.originalChildExit,0);same(terminal.failures,[]);same(terminal.remainingOwnedProcesses,[]);assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.reportSha256,q.qualification.report.sha256);
  const source=q.artifact.path;closed(source);assert.equal(fileHash(source),q.artifact.sha256);assert.notEqual(source,input.destinationPath);assert(!existsSync(input.destinationPath));
  copyFileSync(source,input.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(input.destinationPath),q.artifact.sha256);
  let n=0;const progress=(phase:string,evidence:unknown)=>writeExecutionViewArtifact(join(dirname(input.destinationPath),'checkpoint-'+String(++n).padStart(2,'0')+'-'+phase+'.json'),
    {version:'same_pa_model_inventory_progress_v1',phase,at:new Date().toISOString(),gateQualified:false,evidence});
  const db=new Native(input.destinationPath);let result:unknown;
  try{
    result=withSqliteReadTransaction(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>{
      assertBodyCompositionNativeConnection(db);const beforeRows=rawCensus(db),beforeSchema=schemaCensus(db);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,0);
      progress('inventory-started',{viewReference:q.viewReference,sourceArtifact:q.artifact,rowsHash:hash(beforeRows),schemaHash:hash(beforeSchema)});
      const view=proveSamePaExecution(db,{kind:'view',sourceId:q.viewReference.sourceId}) as SamePaExecutionView;assert(view);same(view,q.view);same(reference('reserved_pa_execution_views',view),q.viewReference);
      const actor=readPhysicalPlateAppearanceActorFromSqlite(db,view.lineage.actorReference.sourceId);assert(actor);same(reference('physical_plate_appearance_actors',actor),view.lineage.actorReference);
      const roles=deriveSamePaDispatchRoles(actor,view);assert.equal(roles.length,10);assert.equal(roles.flatMap(r=>r.routes).length,32);
      progress('original-basis-authenticated',{actorReference:view.lineage.actorReference,memberIds:roles.map(r=>r.member.playerId)});
      const namespace=(table:string)=>{const rows=db.prepare('SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower(?)').all(table);
        assert(rows.length===0||rows.length===1&&rows[0].name===table&&rows[0].type==='table','normal owner namespace differs: '+table);return rows.length===1;};
      const fieldNamespaces={observation:classifyFieldModelNamespace(db,'observation'),decision:classifyFieldModelNamespace(db,'decision'),locomotion:classifyFieldModelNamespace(db,'locomotion')};
      const models:unknown[]=[];const people=[actor.person,...actor.defenderPersons],bindings=[actor.binding,...actor.defenderBindings];
      for(const role of roles){const binding=bindings.find(b=>b.playerId===role.member.playerId)!,person=people.find(p=>p.playerId===role.member.playerId)!;
        if(role.role==='batter'){
          const table='world_player_batting_models',present=namespace(table),owner=playerBattingModelEvidenceFromSqlite(db);
          try{const model=owner.selectAtDay(binding.careerId,binding.playerId,binding.gameDay);same(model.person,person);same(model.bodyMaterialization.person,person);
            assert.equal(model.source.personLinkSourceId,binding.personLinkSourceId);models.push({playerId:binding.playerId,routes:role.routes,status:'owned',modelReference:reference(table,model),bodyReference:reference('world_player_body_materializations',model.bodyMaterialization)});
          }catch(error){if(!(error instanceof Error)||error.message!=='applicable accepted Player batting model is missing')throw error;
            models.push({playerId:binding.playerId,routes:role.routes,status:'missing_applicable_normal_model',namespacePresent:present,normalOwnerAbsence:error.message});}
          continue;
        }
        const routes=[{kind:'observation',route:'defender_observation',table:'world_player_observation_models',missing:'accepted Player observation baseline is missing',owner:()=>playerObservationModelEvidenceFromSqlite(db)},
          {kind:'decision',route:'defender_decision',table:'world_player_decision_models',missing:'accepted Player decision baseline is missing',owner:()=>playerDecisionModelEvidenceFromSqlite(db)},
          {kind:'locomotion',route:'defender_locomotion',table:'world_player_locomotion_models',missing:'accepted Player locomotion baseline is missing',owner:()=>playerLocomotionModelEvidenceFromSqlite(db)}] as const;
        for(const item of routes){if(fieldNamespaces[item.kind]==='pristine'){
            models.push({playerId:binding.playerId,routes:[item.route],status:'missing_applicable_normal_model',namespacePresent:false,absenceBasis:'pristine_namespace_no_surviving_claims'});continue;
          }
          try{const model=item.owner().selectAtDay(binding.careerId,binding.playerId,binding.gameDay);same(model.fieldingModel.person,person);assert.equal(model.source.personLinkSourceId,binding.personLinkSourceId);
            models.push({playerId:binding.playerId,routes:[item.route],status:'owned',modelReference:reference(item.table,model),fieldingReference:reference('world_player_fielding_models',model.fieldingModel)});
          }catch(error){if(!(error instanceof Error)||error.message!==item.missing)throw error;
            models.push({playerId:binding.playerId,routes:[item.route],status:'missing_applicable_normal_model',namespacePresent:true,normalOwnerAbsence:error.message});}
        }
      }
      const pitcher=roles.find(r=>r.role==='P')!,binding=bindings.find(b=>b.playerId===pitcher.member.playerId)!;
      for(const table of ['world_pitch_timing_baselines','world_pitch_timing_heads','world_player_release_baselines','world_player_release_heads'])assert(namespace(table),'original pitcher nominal owner missing');
      // Discover this donor's exact reserved pitcher scope, including raw mirrors.
      // No external fixture manifest contributes a model/policy Source identity.
      const scope=`(career_id=$career OR ${nominalClaim('source_json',['careerId'],'$career')}) AND (player_id=$player OR ${nominalClaim('source_json',['playerId'],'$player')})`;
      const tb=db.prepare('SELECT * FROM main.world_pitch_timing_baselines WHERE '+scope).all({career:binding.careerId,player:binding.playerId});
      const rb=db.prepare('SELECT * FROM main.world_player_release_baselines WHERE '+scope).all({career:binding.careerId,player:binding.playerId});assert.equal(tb.length,1);assert.equal(rb.length,1);
      const tr=tb[0],rr=rb[0],th=db.prepare('SELECT * FROM main.world_pitch_timing_heads WHERE career_id=? AND player_id=?').get(binding.careerId,binding.playerId),rh=db.prepare('SELECT * FROM main.world_player_release_heads WHERE career_id=? AND player_id=?').get(binding.careerId,binding.playerId);
      assert(th&&rh);assert.equal(th.revision,0);assert.equal(rh.revision,0);assert.equal(typeof tr.source_id,'string');assert.equal(typeof rr.source_id,'string');
      const ts=JSON.parse(String(tr.source_json)),rs=JSON.parse(String(rr.source_json));
      for(const s of [ts,rs]){assert.equal(s.careerId,binding.careerId);assert.equal(s.playerId,binding.playerId);assert.equal(s.personLinkSourceId,binding.personLinkSourceId);}
      const timingRef={owner:'world_pitch_timing_baselines' as const,sourceId:tr.source_id as string,sourceHash:hash(ts),snapshotHash:hash(JSON.parse(String(th.state_json)))};
      const releaseRef={owner:'world_player_release_baselines' as const,sourceId:rr.source_id as string,sourceHash:hash(rs),snapshotHash:hash(JSON.parse(String(rh.state_json)))};
      const timing=readPlayerPitchTimingPrefixFromSqlite(db,timingRef),release=readPlayerReleaseGeometryPrefixFromSqlite(db,releaseRef);
      assert.equal(timing.playerId,binding.playerId);assert.equal(release.playerId,binding.playerId);
      assertCurrentPlayerPitchTimingPrefixFromSqlite(db,timingRef,binding.gameDay);selectPlayerPitchTimingProfileFromSqlitePrefix(db,timingRef,binding.gameDay);assertCurrentPlayerReleaseGeometryPrefixFromSqlite(db,releaseRef,binding.gameDay);
      models.push({playerId:binding.playerId,routes:['pitch_delivery'],status:'owned_nominal_models',timingReference:timingRef,releaseReference:releaseRef,
        policyReference:null,policyInputStatus:'pending_owned_pitch_lineage_policy_reference'});
      const inventory={viewReference:q.viewReference,actorReference:view.lineage.actorReference,roles,models};
      assert.equal(models.length,29);same(rawCensus(db),beforeRows);same(schemaCensus(db),beforeSchema);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,0);
      progress('models-inventoried',{inventory,originalRowsAndRowidsPreserved:true,totalChanges:0});return inventory;
    }));
    assert.equal(db.isTransaction,false);assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,0);
  }finally{db.close();}
  assert(!db.isOpen);closed(input.destinationPath);assert.equal(fileHash(input.destinationPath),q.artifact.sha256);closed(source);assert.equal(fileHash(source),q.artifact.sha256);
  for(const f of [{path:input.inputPath,sha256:input.inputSha256},packet.qualifiedViewManifest,packet.sourceCheckpoint,...Object.values(q.qualification)])assert.equal(fileHash(f.path),f.sha256);
  progress('inventory-closed',{destinationSha256:fileHash(input.destinationPath),closedHandles:true,closedSidecars:true,totalChanges:0,inputBytesUnchanged:true});
  return {version:'same_pa_genuine_model_inventory_receipt_v1',qualifiedViewManifest:packet.qualifiedViewManifest,sourceArtifact:q.artifact,destinationPath:input.destinationPath,
    destinationSha256:fileHash(input.destinationPath),inventory:result,totalChanges:0,newTables:0,originalRowsAndRowidsPreserved:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,
    modelInventoryQualified:true,allModelsReadyClaim:false,calibrationSourceAccepted:false,physicalExecutionQualified:false,fixtureOnly:true};
};
