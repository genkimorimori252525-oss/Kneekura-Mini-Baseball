import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync,constants,copyFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve,sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../../src/host/world/SqliteSamePlateAppearancePhysicalEpisodeStore';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { readCurrentSamePaLifecycleViewFromSqlite,readHistoricalSamePaLifecycleViewFromSqlite,readSamePaLifecycleRecordFromSqlite,
  readSamePaLifecycleSetFromSqlite,readSamePaLifecycleCalibrationFromSqlite,withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT,SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as INTEGER,
  SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION as MOTOR } from '../../../src/host/world/SamePlateAppearanceBallPhysics';
import { samePaLifecycleCalibrationInput,SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION } from '../../../src/host/world/SamePlateAppearanceLifecycleCalibrationSource';
import { projectObservationClockV1 } from '../../../src/core/sim/perception/ObservationClockProjectionV1';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import type { SamePaPhysicalFieldRoot,SamePaPhysicalFieldStep,SamePaPhysicalFieldStepSource,SamePaPhysicalOperationReference } from '../../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldAction } from '../../../src/host/world/SamePlateAppearancePhysicalFieldAction';
import type { SamePaLifecycleCalibration } from '../../../src/host/world/SamePlateAppearanceLifecycleCalibrationSource';
import type { SamePaLifecycleViewBasis,SamePaLifecycleTotal,SamePaLifecyclePrefix } from '../../../src/host/world/SamePlateAppearanceLifecycle';
import type { SamePaReference } from '../../../src/host/world/SamePlateAppearanceWorkPrefix';
import { integerTeamStages,nextAdoptionAction,orderedDefenders,observationEyeBaseline,type TeamStage } from './integer-team-plan';

/** Offline reproduction, never an autonomous live-game policy. The entry is a
 * CLOSED, independently authenticated INTEGER/O1/cut15 snapshot. Source maps
 * are declarations only. Every admission remains with the original owner.
 * One process can run several bounded stages without repeated CLI prologues;
 * run recovery uses original reads for committed work, never accept-as-read. */
type ViewRef=SamePaReference<'pa_lifecycle_v1_execution_views'>;
type StepRef=SamePaReference<'pa_physical_v1_field_steps'>;
type CalRef=SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
type Field=SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
type Route='defender_observation'|'defender_decision'|'defender_locomotion';
type Entry=Readonly<{databasePath:string;sourceMapPath:string;databaseHash:string;sourceMapHash:string;
  rootReference:SamePaReference<'pa_physical_v1_field_roots'>;viewReference:ViewRef;currentPhysicalReference:StepRef;
  existingObservationReference:StepRef;existingCalibrationReference:CalRef;originalCalibrationViewReference:ViewRef;
  namespace:string;sourceScope:'explicit-synthetic-integer-team-reproduction-v1'}>;
type Prior={playerId:string;observation:CalRef;decision:CalRef;locomotion:CalRef};
type Plan={entry:Entry;bundleHash:string;nodeVersion:string;players:readonly string[];priors:readonly Prior[];ticksPerSecond:number;
  sourceScope:Entry['sourceScope'];clockEvidence:object;nominalMappings:readonly object[];policy:Extract<SamePaPhysicalFieldAction,{kind:'defender_decision_v1'}>['priorities']};
const [entryArgument,outArgument,mode='prepare',through='actor-8',recoveryPidArgument]=process.argv.slice(2);
assert.ok(entryArgument&&outArgument,'entry manifest and private output directory are required');
assert.ok(['prepare','run','wait','motor','checkpoint','verify'].includes(mode));
const entryPath=resolve(entryArgument),entry=JSON.parse(readFileSync(entryPath,'utf8')) as Entry,out=resolve(outArgument);
assert.equal(entry.sourceScope,'explicit-synthetic-integer-team-reproduction-v1');assert.match(entry.namespace,/^[a-z][a-z0-9-]{2,80}$/);
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),bundleHash=sha(resolve(process.argv[1]));
const inputDb=resolve(entry.databasePath),inputMap=resolve(entry.sourceMapPath),immutableDirectory=dirname(inputDb);
assert.ok(out!==immutableDirectory&&!out.startsWith(immutableDirectory+sep),'private output must be outside the immutable snapshot directory');
assert.ok(out!==dirname(inputMap)&&!out.startsWith(dirname(inputMap)+sep));
const unchanged=()=>{assert.equal(sha(inputDb),entry.databaseHash);assert.equal(sha(inputMap),entry.sourceMapHash);};unchanged();
const atomic=(p:string,value:unknown)=>{const pending=p+'.pending-'+process.pid;writeFileSync(pending,JSON.stringify(value,null,2),{flag:'wx'});renameSync(pending,p);};
mkdirSync(out,{recursive:true});
const activeLock=join(out,'ACTIVE_RUN.json');let lockOwned=false;
if(mode!=='verify'){
  if(existsSync(activeLock)){
    const old=JSON.parse(readFileSync(activeLock,'utf8'));assert.equal(Number(recoveryPidArgument),old.pid,'an abandoned run requires its explicit old PID; never restart a live owner');
    let alive=true;try{process.kill(old.pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')alive=false;else throw error;}
    assert.equal(alive,false,'prior owner is still alive; observe without restarting');
    renameSync(activeLock,join(out,'abandoned-lock-'+old.pid+'-'+Date.now()+'.json'));
  }
  writeFileSync(activeLock,JSON.stringify({pid:process.pid,mode,through,bundleHash,at:new Date().toISOString()}),{flag:'wx'});lockOwned=true;
}
const path=join(out,'team.sqlite'),mapPath=join(out,'accepted-sources.json'),planPath=join(out,'plan.json');
if(mode==='prepare'){
  assert.ok(!existsSync(path)&&!existsSync(mapPath)&&!existsSync(planPath),'prepare never overwrites an existing attempt');
  copyFileSync(inputDb,path,constants.COPYFILE_EXCL);copyFileSync(inputMap,mapPath,constants.COPYFILE_EXCL);
}else assert.ok(existsSync(path)&&existsSync(mapPath)&&existsSync(planPath),'prepare must finish first');
const sources=new Map<string,unknown>(JSON.parse(readFileSync(mapPath,'utf8'))),originalSources=new Map<string,unknown>(JSON.parse(readFileSync(inputMap,'utf8')));
const oldSourcesUnchanged=()=>{for(const[id,s]of originalSources)assert.deepEqual(sources.get(id),s);};oldSourcesUnchanged();
const publish=<T extends {sourceId:string}>(s:T):T=>{if(sources.has(s.sourceId))assert.deepEqual(sources.get(s.sourceId),s,'published Source ID collision');
  else {sources.set(s.sourceId,s);atomic(mapPath,[...sources]);}return s;};
const raw=new DatabaseSync(path,{readOnly:true});
const phase=<T>(read:()=>T):T=>withSqliteReadTransaction(raw,()=>withSamePaLifecycleReadPhase(raw,read));
const rawRecord=<T>(table:string,id:string):T|null=>{assert.match(table,/^[a-z][a-z0-9_]*$/);const row=raw.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM '+table+' WHERE source_id=?').get(id);
  if(!row)return null;const source=JSON.parse(String(row.source_json)),value=JSON.parse(String(row.snapshot_json));
  assert.equal(hash(source),row.source_hash);assert.equal(hash(value),row.snapshot_hash);assert.deepEqual(value.source,source);
  assert.deepEqual(sources.get(id),source,'saved record must match the durable Source declaration');return value as T;};
const rawField=(id:string)=>rawRecord<SamePaPhysicalFieldStep>('pa_physical_v1_field_steps',id);
const rawView=(id:string)=>rawRecord<SamePaLifecycleViewBasis['view']>('pa_lifecycle_v1_execution_views',id);
const fieldRef=(f:Field)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
const ownedField=(r:SamePaPhysicalOperationReference):Field=>{const f=readSamePaPhysicalOperationFromSqlite(raw,r).record;
  assert.ok(f.kind==='same_pa_physical_field_root_v1'||f.kind==='same_pa_physical_field_step_v1');return f;};
let physical:ReturnType<typeof openSqliteSamePlateAppearancePhysicalEpisodeStore>|undefined,lifecycle:ReturnType<typeof openSqliteSamePlateAppearanceLifecycleStore>|undefined;
const physicalOwner=()=>physical??=openSqliteSamePlateAppearancePhysicalEpisodeStore(path,{readAcceptedOperation:id=>sources.get(id)});
const lifecycleOwner=()=>lifecycle??=openSqliteSamePlateAppearanceLifecycleStore(path,{readAcceptedPrefix:id=>sources.get(id),readAcceptedTotal:id=>sources.get(id),readAcceptedView:id=>sources.get(id),readAcceptedCalibration:id=>sources.get(id)});
const auditPath=join(out,'attempt-'+process.pid+'-'+Date.now()+'.jsonl');
const audit=(event:string,value:object={})=>appendFileSync(auditPath,JSON.stringify({event,pid:process.pid,at:new Date().toISOString(),...value})+'\n');
const guard=()=>{assert.ok(!existsSync(join(out,'STOP_CONTROL')),'STOP_CONTROL: no next owner write launched');unchanged();oldSourcesUnchanged();};
const call=<T>(label:string,writer:()=>T):T=>{guard();audit('owner-call-start',{label});const t=Date.now();const value=writer();audit('owner-call-return',{label,elapsedMilliseconds:Date.now()-t});return value;};
const stages=integerTeamStages(),ns=entry.namespace,id=(name:string)=>ns+':'+name;
let plan:Plan,viewRef=entry.viewReference;
const basis=(historical=false)=>phase(()=>(historical?readHistoricalSamePaLifecycleViewFromSqlite:readCurrentSamePaLifecycleViewFromSqlite)(raw,viewRef));
const current=()=>phase(()=>{const b=readCurrentSamePaLifecycleViewFromSqlite(raw,viewRef);
  return {b,f:ownedField(b.view.cut.physicalOperationReference as SamePaPhysicalOperationReference)};});
const calibration=(r:CalRef)=>readSamePaLifecycleCalibrationFromSqlite(raw,r);
const priorFor=(player:string,route:Route)=>{const p=plan.priors.find(p=>p.playerId===player);assert.ok(p);return calibration(p[route==='defender_observation'?'observation':route==='defender_decision'?'decision':'locomotion']);};
const latestObservation=(player:string):StepRef|null=>{
  const rows=raw.prepare('SELECT source_id FROM pa_physical_v1_field_steps ORDER BY rowid DESC').all();
  for(const row of rows){const f=rawField(String(row.source_id));if(f?.actionResult?.kind==='defender_observation_v1'&&f.actionResult.playerId===player
    &&hash(f.lineage)===hash(rawRecord<SamePaPhysicalFieldRoot>('pa_physical_v1_field_roots',entry.rootReference.sourceId)!.lineage))return reference('pa_physical_v1_field_steps',f);}return null;};
const calFor=(b:SamePaLifecycleViewBasis,f:Field,player:string,route:Route):CalRef=>{
  const member=b.members.find(m=>m.playerId===player);assert.ok(member);
  const existing=raw.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? AND player_id=? AND route=?').all(viewRef.sourceId,player,route);
  assert.ok(existing.length<=1,'same-view/member/route alias');
  if(existing.length){const c=rawRecord<SamePaLifecycleCalibration>('pa_lifecycle_v1_execution_calibrations',String(existing[0].source_id));assert.ok(c);
    return phase(()=>{const owned=calibration(reference('pa_lifecycle_v1_execution_calibrations',c));assert.deepEqual(owned.source.member,member);
      assert.deepEqual(owned.source.viewReference,viewRef);if(route==='defender_observation')assert.equal(owned.observationClockProjection?.authority,'UNIT_CONVERSION_NOT_ABILITY_CHANGE');
      return reference('pa_lifecycle_v1_execution_calibrations',owned);});}
  const previous=phase(()=>priorFor(player,route));assert.equal(previous.source.route,route);
  const old=previous.source;
  const projection=old.route==='defender_observation'?{response:{kind:'accepted_execution_values_v1',values:projectObservationClockV1(old.response.values,plan.ticksPerSecond)},
    observationClockProjection:{kind:'observation_clock_projection_v1',originalNominalReference:old.nominalReference,
      originalEffectiveCalibrationReference:reference('pa_lifecycle_v1_execution_calibrations',previous),fieldReference:fieldRef(f)}}:{};
  assert.ok(!old.observationClockProjection,'do not chain a unit projection');
  const source=publish(samePaLifecycleCalibrationInput({...old,sourceId:id('cal:'+f.source.sourceId+':'+player+':'+route),
    sourceVersion:route==='defender_observation'?SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION:'integer-team-explicit-synthetic-prior-v1',viewReference:viewRef,member,
    provenance:{assessmentSourceId:id('assessment:'+f.source.sourceId+':'+player+':'+route),assessmentVersion:'explicit-synthetic-unit-aware-v1',calibrationSourceId:old.sourceId,calibrationVersion:old.sourceVersion},...projection}));
  const result=call(source.sourceId,()=>lifecycleOwner().acceptDefenderExecutionCalibrationV1(source.sourceId));
  assert.equal(result.kind,'same_pa_lifecycle_calibration');if(result.kind!=='same_pa_lifecycle_calibration')throw new Error('calibration pending');
  return reference('pa_lifecycle_v1_execution_calibrations',result);
};
const adoption=(stage:string,step:SamePaPhysicalFieldStep,priorView:ViewRef):ViewRef=>{
  const nextViewId=id(stage+':view'),saved=rawView(nextViewId);
  if(saved){assert.deepEqual(saved.cut.physicalOperationReference,reference('pa_physical_v1_field_steps',step));return reference('pa_lifecycle_v1_execution_views',saved);}
  const old=phase(()=>{const b=readHistoricalSamePaLifecycleViewFromSqlite(raw,priorView),p=readSamePaLifecycleRecordFromSqlite(raw,'prefix',b.view.source.prefixReference.sourceId);
    assert.ok(p?.kind==='same_pa_lifecycle_prefix');const totals=readSamePaLifecycleSetFromSqlite(raw,'total',b.view.source.participantTotalReferences.map(r=>r.assessmentReference.sourceId));
    assert.ok(totals.every(t=>t?.kind==='same_pa_lifecycle_total'));return {b,p,totals:totals as SamePaLifecycleTotal[]};});
  assert.deepEqual(old.b.view.cut.physicalOperationReference,step.source.previousOperationReference);
  const prefixSource=publish({...old.p.source,sourceId:id(stage+':prefix'),sourceVersion:'explicit-synthetic-integer-team-lifecycle-v1',eventReferences:[...old.p.source.eventReferences,reference('pa_physical_v1_field_steps',step)]});
  const existingPrefix=rawRecord<SamePaLifecyclePrefix>('pa_lifecycle_v1_work_prefixes',prefixSource.sourceId);
  const p=existingPrefix?phase(()=>readSamePaLifecycleRecordFromSqlite(raw,'prefix',prefixSource.sourceId)):call(prefixSource.sourceId,()=>lifecycleOwner().acceptPrefix(prefixSource.sourceId));
  assert.ok(p?.kind==='same_pa_lifecycle_prefix');
  const prefixReference=reference('pa_lifecycle_v1_work_prefixes',p);
  const totalSources=old.totals.map(t=>publish({...t.source,sourceId:id(stage+':total:'+t.source.participantReference.playerId),
    sourceVersion:'explicit-synthetic-integer-team-lifecycle-v1',prefixReference,provenance:{assessmentSourceId:id(stage+':total-assessment:'+t.source.participantReference.playerId),
      assessmentVersion:'explicit-synthetic-integer-team-lifecycle-v1',calibrationSourceId:t.source.sourceId,calibrationVersion:t.source.sourceVersion}}));
  const present=totalSources.map(s=>rawRecord<SamePaLifecycleTotal>('pa_lifecycle_v1_total_assessments',s.sourceId));
  const action=nextAdoptionAction({physical:true,prefix:true,totals:present.map(Boolean),view:false});
  const totals=action==='view'?phase(()=>readSamePaLifecycleSetFromSqlite(raw,'total',totalSources.map(s=>s.sourceId))):(()=>{
    const result=call(stage+':TOTAL',()=>lifecycleOwner().acceptTotalSet(totalSources.map(s=>s.sourceId)));
    assert.equal(result.kind,'same_pa_lifecycle_total_set');if(result.kind!=='same_pa_lifecycle_total_set')throw new Error('TOTAL pending');return result.totals;})();
  assert.ok(totals.every(t=>t?.kind==='same_pa_lifecycle_total'));
  const viewSource=publish({...old.b.view.source,sourceId:nextViewId,sourceVersion:'explicit-synthetic-integer-team-lifecycle-v1',prefixReference,
    participantTotalReferences:(totals as readonly SamePaLifecycleTotal[]).map(t=>({playerId:t.source.participantReference.playerId,assessmentReference:reference('pa_lifecycle_v1_total_assessments',t)}))});
  const view=call(viewSource.sourceId,()=>lifecycleOwner().acceptView(viewSource.sourceId));assert.equal(view.kind,'same_pa_lifecycle_view');
  if(view.kind!=='same_pa_lifecycle_view')throw new Error('view pending');assert.deepEqual(view.cut.physicalOperationReference,reference('pa_physical_v1_field_steps',step));
  return reference('pa_lifecycle_v1_execution_views',view);
};
const stepSource=(name:string,b:SamePaLifecycleViewBasis,f:Field,action:SamePaPhysicalFieldAction|undefined,throughTick=f.evaluationTick,sourceVersion: string=INTEGER):SamePaPhysicalFieldStepSource=>{
  assert.equal(f.kind,'same_pa_physical_field_step_v1');if(f.kind!=='same_pa_physical_field_step_v1')throw new Error('integer step required');
  assert.equal(f.source.sourceVersion,INTEGER,'first motor branches only from INTEGER');
  return {sourceId:id(name),sourceVersion,capability:'same_pa_physical_field_step_v1',viewReference:reference('pa_lifecycle_v1_execution_views',b.view),
    launchReference:f.source.launchReference,previousOperationReference:reference('pa_physical_v1_field_steps',f),previousFieldReference:reference('pa_physical_v1_field_steps',f),
    fieldRootReference:entry.rootReference,throughTick,...(action?{action}:{})};
};
const ownStep=(source:SamePaPhysicalFieldStepSource):SamePaPhysicalFieldStep=>{
  publish(source);const saved=rawField(source.sourceId);
  if(saved)return phase(()=>{const f=ownedField(reference('pa_physical_v1_field_steps',saved));assert.equal(f.kind,'same_pa_physical_field_step_v1');return f as SamePaPhysicalFieldStep;});
  const value=call(source.sourceId,()=>physicalOwner().acceptOperation(source.sourceId));assert.equal(value.kind,'same_pa_physical_field_step_v1');
  if(value.kind!=='same_pa_physical_field_step_v1')throw new Error('physical operation pending');return value;
};
const metadataAction=(s:TeamStage,b:SamePaLifecycleViewBasis,f:Field):SamePaPhysicalFieldAction=>{
  const player=s.index===null?null:plan.players[s.index],member=b.members.find(m=>m.playerId===player);
  if(s.kind==='team')return {kind:'defender_team_selection_v1',candidateReferences:plan.players.map((_,i)=>reference('pa_physical_v1_field_steps',rawField(id('candidate-'+i))!)),requireBallHandler:true};
  assert.ok(player&&member);
  if(s.kind==='actor')return {kind:'defender_actor_selection_v1',member,teamSelectionReference:reference('pa_physical_v1_field_steps',rawField(id('team'))!)};
  if(s.kind==='candidate')return {kind:'defender_candidate_set_v1',originalDecisionReference:reference('pa_physical_v1_field_steps',rawField(id('decision-'+s.index))!)};
  const calibrationReference=calFor(b,f,player,s.kind==='observation'?'defender_observation':'defender_decision');
  if(s.kind==='decision')return {kind:'defender_decision_v1',member,calibrationReference,observationReference:reference('pa_physical_v1_field_steps',rawField(id('observation-'+s.index))!),priorities:plan.policy,
    supportGeometry:{kind:'perceived_ball_support_geometry_v1',base:1}};
  const root=rawRecord<SamePaPhysicalFieldRoot>('pa_physical_v1_field_roots',entry.rootReference.sourceId)!,motion=f.field.motion,moment=motion.world.moment;
  const body=motion.actors.find(a=>a.playerId===player&&a.primitive.role==='body');assert.ok(body);assert.ok(motion.cursor);
  const dt=(moment.originTick-body.primitive.startTick)/root.response.world.parameters.ticksPerSecond+moment.elapsedSeconds-(body.startElapsedSeconds??0);
  const center=(axis:'x'|'y'|'z')=>body.primitive.startCenter[axis]+body.primitive.startVelocity[axis]*dt+.5*body.primitive.acceleration[axis]*dt*dt;
  const previousObservationReference=latestObservation(player),prior=previousObservationReference?rawField(previousObservationReference.sourceId):null;
  if(prior)assert.ok(prior.actionResult?.kind==='defender_observation_v1');
  const eye=observationEyeBaseline(prior?.actionResult?.kind==='defender_observation_v1'?prior.actionResult.samplingRequest.view:null),offset=eye.bodyRelativeEyeOffset;
  return {kind:'defender_observation_v1',member,calibrationReference,previousObservationReference,view:{...eye,
    attentionTarget:{kind:'ball'},forward:{x:moment.ball.position.x-center('x')-offset.x,y:moment.ball.position.y-center('y')-offset.y,z:moment.ball.position.z-center('z')-offset.z}}};
};
const closedCheckpoint=(name:string)=>{
  // Original handles are closed before exporting a read-only backup. No active
  // WAL/SHM is copied as an immutable DB, and the entry is never checkpointed.
  physical?.close();physical=undefined;lifecycle?.close();lifecycle=undefined;
  const directory=join(out,'closed-'+name+'-'+Date.now());mkdirSync(directory,{recursive:false});const dbPath=join(directory,'checkpoint.sqlite'),sourceMapPath=join(directory,'accepted-sources.json');
  raw.prepare('VACUUM INTO ?').run(dbPath);copyFileSync(mapPath,sourceMapPath,constants.COPYFILE_EXCL);
  const check=new DatabaseSync(dbPath,{readOnly:true});try{assert.equal(check.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');}finally{check.close();}
  const manifest={databasePath:dbPath,sourceMapPath,databaseHash:sha(dbPath),sourceMapHash:sha(sourceMapPath),rootReference:entry.rootReference,viewReference:viewRef,
    physicalReference:basis().view.cut.physicalOperationReference,bundleHash,entryHash:sha(entryPath),planHash:sha(planPath),pid:process.pid,name,
    sourceScope:entry.sourceScope,nineBodyExecution:'UNVERIFIED_UNTIL_INDEPENDENT_OWNER_READ',officialResult:null};
  atomic(join(directory,'manifest.json'),manifest);audit('closed-checkpoint',manifest);return manifest;
};
const started=Date.now();
try{
  audit('start',{mode,through,bundleHash,entryHash:sha(entryPath)});
  if(mode==='prepare'){
    assert.equal(raw.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
    const foundation=phase(()=>{
      const b=readCurrentSamePaLifecycleViewFromSqlite(raw,entry.viewReference),root=ownedField(entry.rootReference),f=ownedField(entry.currentPhysicalReference),o=ownedField(entry.existingObservationReference),c=calibration(entry.existingCalibrationReference);
      assert.equal(root.kind,'same_pa_physical_field_root_v1');if(root.kind!=='same_pa_physical_field_root_v1')throw new Error('field root missing');
      assert.equal(root.source.sourceVersion,ROOT);assert.equal(f.kind,'same_pa_physical_field_step_v1');if(f.kind!=='same_pa_physical_field_step_v1')throw new Error('INTEGER step missing');
      assert.equal(f.source.sourceVersion,INTEGER);assert.deepEqual(b.view.cut.physicalOperationReference,entry.currentPhysicalReference);
      assert.ok(o.kind==='same_pa_physical_field_step_v1'&&o.actionResult?.kind==='defender_observation_v1');
      assert.equal(c.source.route,'defender_observation');assert.deepEqual(c.source.viewReference,entry.viewReference);assert.equal(c.observationClockProjection?.authority,'UNIT_CONVERSION_NOT_ABILITY_CHANGE');
      assert.equal(f.field.motion.carrierPlayerId,null);assert.ok(f.field.motion.cursor?.sourceCurve);
      assert.equal(f.field.motion.cursor.moment.elapsedSeconds,(f.evaluationTick-f.field.motion.cursor.moment.originTick)/root.response.world.parameters.ticksPerSecond);
      const priorIds=raw.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(entry.originalCalibrationViewReference.sourceId).map(r=>String(r.source_id));
      const prior=readSamePaLifecycleSetFromSqlite(raw,'calibration',priorIds);assert.ok(prior.every(c=>c?.kind==='same_pa_lifecycle_calibration'));
      const players=orderedDefenders(b.actor.defenderBindings.map(d=>d.playerId),c.source.member.playerId);
      const priors=players.map(playerId=>{const one=(route:Route)=>{const matches=(prior as SamePaLifecycleCalibration[]).filter(c=>c.source.member.playerId===playerId&&c.source.route===route);assert.equal(matches.length,1);
        assert.ok(!matches[0].source.observationClockProjection);return reference('pa_lifecycle_v1_execution_calibrations',matches[0]);};
        return {playerId,observation:one('defender_observation'),decision:one('defender_decision'),locomotion:one('defender_locomotion')};});
      const nominalMappings=(prior as SamePaLifecycleCalibration[]).filter(c=>players.includes(c.source.member.playerId)&&['defender_observation','defender_decision','defender_locomotion'].includes(c.source.route))
        .map(c=>({playerId:c.source.member.playerId,route:c.source.route,calibrationReference:reference('pa_lifecycle_v1_execution_calibrations',c),nominalReference:c.source.nominalReference,
          acceptedAtDay:c.source.acceptedAtDay,effectiveResponseHash:c.effectiveResponseHash,originalValues:c.source.response}));
      assert.equal(nominalMappings.length,27);return {b,root,f,players,priors,nominalMappings};
    });
    plan={entry,bundleHash,nodeVersion:process.version,players:foundation.players,priors:foundation.priors,nominalMappings:foundation.nominalMappings,ticksPerSecond:foundation.root.response.world.parameters.ticksPerSecond,sourceScope:entry.sourceScope,
      clockEvidence:{physical:'ORIGINAL_SOURCE_FIELD_CLOCK',observation:'VERSIONED_SECONDS_EQUIVALENT_PROJECTION',decision:'ORIGINAL_PRIOR_TICK_ORIGIN_UNKNOWN_EXPLICIT_SYNTHETIC_TARGET_TICKS_UNCHANGED',
        locomotion:'ORIGINAL_PRIOR_TICK_ORIGIN_UNKNOWN_EXPLICIT_SYNTHETIC_TARGET_TICKS_UNCHANGED',measuredHumanLatency:false,automaticDecisionOrLocomotionScaling:false},
      policy:{ballPursuitPriority:1,baseCoverPriorities:[],relayPriority:1,backupPriority:1,deepCoveragePriority:1,holdPriority:0}};
    atomic(planPath,plan);atomic(join(out,'prepare-receipt.json'),{status:'PASS_READONLY_ENTRY_AND_ORIGINAL_PRIORS',bundleHash,entryHash:sha(entryPath),players:plan.players,priors:plan.priors,nominalMappings:plan.nominalMappings,
      clockEvidence:plan.clockEvidence,metadataStages:stages,plannedMetadata:37,plannedCalibrationMaximum:27,existingObservationIsFoundationOnly:true,
      existingCurrentCalibrationReused:true,bodyExecution:false,officialResult:null,pid:process.pid});
  }else{
    plan=JSON.parse(readFileSync(planPath,'utf8'));assert.deepEqual(plan.entry,entry);assert.equal(plan.bundleHash,bundleHash,'frozen bundle changed');
    if(mode!=='verify'){
    // Authenticate the actual most recent committed physical head and covering
    // view once. Raw scans only identify refs; they cannot become proof tokens.
    const acceptedStages=[...stages.map(s=>s.name),'due-wait','motor'].filter(name=>rawField(id(name)));
    let sawMissing=false;for(const s of stages){if(!rawField(id(s.name)))sawMissing=true;else assert.ok(!sawMissing,'nonconsecutive metadata records');}
    for(const name of acceptedStages){const v=rawView(id(name+':view'));if(v)viewRef=reference('pa_lifecycle_v1_execution_views',v);}
    const last=acceptedStages.at(-1),head=last?reference('pa_physical_v1_field_steps',rawField(id(last))!):entry.currentPhysicalReference;
    phase(()=>{const b=readHistoricalSamePaLifecycleViewFromSqlite(raw,viewRef),f=ownedField(head);assert.deepEqual(f.source.sourceId,head.sourceId);
      if(hash(b.view.cut.physicalOperationReference)===hash(head))readCurrentSamePaLifecycleViewFromSqlite(raw,viewRef);
      else assert.deepEqual((f as SamePaPhysicalFieldStep).source.viewReference,viewRef);});
    // If the last physical commit survived but its lifecycle adoption did not,
    // finish only the missing prefix/TOTAL/view owners before a subsequent cut.
    if(last&&!rawView(id(last+':view'))){const saved=rawField(id(last))!;viewRef=adoption(last,saved,saved.source.viewReference);}
    }
    if(mode==='run'){
      const limit=stages.findIndex(s=>s.name===through);assert.ok(limit>=0,'through must name one explicit metadata stage');
      viewRef=entry.viewReference;
      for(const s of stages.slice(0,limit+1)){
        const saved=rawField(id(s.name));if(saved){viewRef=adoption(s.name,saved,saved.source.viewReference);continue;}
        guard();const {b,f}=current(),source=stepSource(s.name,b,f,metadataAction(s,b,f));
        const value=ownStep(source);assert.deepEqual(value.field,f.field);assert.deepEqual(value.timeline,f.timeline);assert.equal(value.evaluationTick,f.evaluationTick);
        viewRef=adoption(s.name,value,source.viewReference);audit('metadata-stage-complete',{stage:s.name,physicalReference:reference('pa_physical_v1_field_steps',value),viewReference:viewRef,movementAdmission:false});
      }
      if(through==='actor-8')closedCheckpoint('actors');
    }else if(mode==='checkpoint')closedCheckpoint(through);
    else if(mode==='verify'){
      // Verification is a separate CLI process reading an immutable closed
      // snapshot directly. It accepts no Source or Native writer connection.
      const manifestPath=resolve(through),m=JSON.parse(readFileSync(manifestPath,'utf8'));
      assert.equal(m.bundleHash,bundleHash);assert.equal(m.planHash,sha(planPath));assert.deepEqual(m.rootReference,entry.rootReference);
      assert.notEqual(m.pid,process.pid);assert.equal(sha(m.databasePath),m.databaseHash);assert.equal(sha(m.sourceMapPath),m.sourceMapHash);
      const closed=new DatabaseSync(m.databasePath,{readOnly:true});try{
        const proof=withSqliteReadTransaction(closed,()=>withSamePaLifecycleReadPhase(closed,()=>{
          const b=readCurrentSamePaLifecycleViewFromSqlite(closed,m.viewReference),f=readSamePaPhysicalOperationFromSqlite(closed,m.physicalReference).record;
          const root=readSamePaPhysicalOperationFromSqlite(closed,entry.rootReference).record;assert.deepEqual(f.lineage,root.lineage);
          assert.deepEqual(b.view.cut.physicalOperationReference,m.physicalReference);
          const actors=plan.players.map((playerId,index)=>{const row=closed.prepare('SELECT source_hash,snapshot_hash FROM pa_physical_v1_field_steps WHERE source_id=?').get(id('actor-'+index));assert.ok(row);
            const ref:StepRef={owner:'pa_physical_v1_field_steps',sourceId:id('actor-'+index),sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};
            const value=readSamePaPhysicalOperationFromSqlite(closed,ref).record;
            assert.ok(value.kind==='same_pa_physical_field_step_v1'&&value.actionResult?.kind==='defender_actor_selection_v1');assert.equal(value.actionResult.playerId,playerId);return {playerId,reference:reference('pa_physical_v1_field_steps',value),result:value.actionResult};});
          let motors:unknown=null,actualBodies:unknown=null;if(f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='defender_motion_v1'){
            const owned=f.actionResult.motors;assert.equal(owned.length,9);assert.equal(new Set(owned.map(m=>m.self.playerId)).size,9);motors=owned;
            const moment=f.field.motion.world.moment;
            actualBodies=owned.map(motor=>{const body=f.field.motion.actors.find(a=>a.playerId===motor.self.playerId&&a.primitive.role==='body');assert.ok(body);
              const priorBody=motor.self.roles.find(r=>r.role==='body');assert.ok(priorBody);
              const seconds=moment.elapsedSeconds-motor.startAt.elapsedSeconds;assert.ok(seconds>0,'a receipt without executed physical progress earns no body credit');
              const dt=(moment.originTick-body.primitive.startTick)/motor.self.ticksPerSecond+moment.elapsedSeconds-(body.startElapsedSeconds??0);
              const after=(axis:'x'|'y'|'z')=>body.primitive.startCenter[axis]+body.primitive.startVelocity[axis]*dt+.5*body.primitive.acceleration[axis]*dt*dt;
              const before=(axis:'x'|'y'|'z')=>motor.self.root.position[axis]+priorBody.declaredPose.offset[axis];
              const beforeCenter={x:before('x'),y:before('y'),z:before('z')},afterCenter={x:after('x'),y:after('y'),z:after('z')};
              return {playerId:motor.self.playerId,intent:motor.intent,executedSeconds:seconds,beforeCenter,afterCenter,
                displacementMeters:Math.hypot(afterCenter.x-beforeCenter.x,afterCenter.y-beforeCenter.y,afterCenter.z-beforeCenter.z),command:motor.command};});
          }
          return {currentReference:m.physicalReference,actors,motors,actualBodies,bodyEvidence:motors===null?'METADATA_ONLY_ZERO_BODY_CREDIT':'NINE_ORIGINAL_ADOPTED_MOTORS_AND_ACTUAL_EXECUTED_WORLD',
            physicalClock:root.kind==='same_pa_physical_field_root_v1'?root.response.world.parameters.ticksPerSecond:null};
        }));
        assert.equal(sha(m.databasePath),m.databaseHash);assert.equal(sha(m.sourceMapPath),m.sourceMapHash);
        atomic(join(dirname(manifestPath),'independent-owner-receipt.json'),{status:'PASS_INDEPENDENT_ORIGINAL_OWNER_READ',...proof,manifestHash:sha(manifestPath),bundleHash,pid:process.pid,
          sourceMapNotAuthority:true,clockEvidence:plan.clockEvidence,measuredHumanLatency:false,officialResult:null,elapsedMilliseconds:Date.now()-started});
      }finally{closed.close();}
    }else{
      // Source team motor requires all nine original actor assignments. The
      // independent immutable actor proof is a launch barrier, not authority.
      const proofPath=resolve(through),proof=JSON.parse(readFileSync(proofPath,'utf8'));assert.equal(proof.status,'PASS_INDEPENDENT_ORIGINAL_OWNER_READ');assert.equal(proof.bundleHash,bundleHash);
      assert.notEqual(proof.pid,process.pid);assert.equal(proof.actors.length,9);assert.equal(proof.motors,null);
      assert.deepEqual(proof.actors.map((a:{playerId:string})=>a.playerId),plan.players);
      const priorMotor=rawField(id('motor'));
      if(mode==='motor'&&priorMotor){
        phase(()=>{const value=ownedField(reference('pa_physical_v1_field_steps',priorMotor));assert.ok(value.kind==='same_pa_physical_field_step_v1'&&value.actionResult?.kind==='defender_motion_v1');});
        viewRef=adoption('motor',priorMotor,priorMotor.source.viewReference);closedCheckpoint('motor-recovered');
      }else{
      guard();
      const {b,f}=current(),actors=plan.players.map((playerId,index)=>{const a=rawField(id('actor-'+index));assert.ok(a?.actionResult?.kind==='defender_actor_selection_v1');assert.equal(a.actionResult.playerId,playerId);return a;});
      const dueTick=Math.max(...actors.map(a=>{assert.ok(a.actionResult?.kind==='defender_actor_selection_v1');return a.actionResult.scheduling.movementStartTick;}));
      if(mode==='wait'){
        const savedWait=rawField(id('due-wait'));
        if(savedWait)assert.ok(savedWait.evaluationTick>=dueTick,'preserved physical boundary occurred before all owned motors became due; no replacement wait is permitted');
        else if(dueTick>f.evaluationTick){const value=ownStep(stepSource('due-wait',b,f,undefined,dueTick));viewRef=adoption('due-wait',value,value.source.viewReference);
          assert.ok(value.evaluationTick>=dueTick,'physical boundary occurred before all owned motors became due');}
        audit('due-reached',{dueTick,viewReference:viewRef});
      }else{
        assert.ok(dueTick<=f.evaluationTick,'actual event-free due wait must be admitted before motor');
        const selections=plan.players.map((playerId,index)=>{const member=b.members.find(m=>m.playerId===playerId);assert.ok(member);return {member,
          decisionReference:reference('pa_physical_v1_field_steps',actors[index]),calibrationReference:calFor(b,f,playerId,'defender_locomotion')};});
        // ActualLocomotion owns one integration segment, capped by each
        // unchanged effective maxIntegrationStepTicks and retained role end.
        const maximumStepTicks=phase(()=>Math.min(...selections.map(s=>{const c=calibration(s.calibrationReference);
          assert.equal(c.source.route,'defender_locomotion');if(c.source.route!=='defender_locomotion')throw new Error('locomotion route differs');return c.source.response.values.maxIntegrationStepTicks;})));
        const throughTick=Math.min(f.evaluationTick+maximumStepTicks,...f.field.motion.actors.map(a=>a.primitive.endTick));
        assert.ok(Number.isSafeInteger(throughTick)&&throughTick>f.evaluationTick);
        const value=ownStep(stepSource('motor',b,f,{kind:'defender_motion_v1',selections},throughTick,MOTOR));
        assert.ok(value.actionResult?.kind==='defender_motion_v1');assert.equal(value.actionResult.motors.length,9);viewRef=adoption('motor',value,value.source.viewReference);
        closedCheckpoint('motor');
      }
      }
    }
  }
  unchanged();oldSourcesUnchanged();audit('complete',{mode,elapsedMilliseconds:Date.now()-started,officialResult:null});
  console.log(JSON.stringify({status:'PASS_REQUESTED_STAGE_ONLY',mode,through,out,bundleHash,elapsedMilliseconds:Date.now()-started,officialResult:null}));
}catch(error){audit('FAIL_PRESERVED',{message:String(error),stack:error instanceof Error?error.stack:null,elapsedMilliseconds:Date.now()-started});throw error;}
finally{physical?.close();lifecycle?.close();raw.close();if(lockOwned)renameSync(activeLock,join(out,'finished-lock-'+process.pid+'-'+Date.now()+'.json'));}
