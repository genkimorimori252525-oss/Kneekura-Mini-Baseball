import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { openSqliteInitialPitchHandHoldStore,initialPitchHandHoldTable,type AcceptedInitialPitchHandHoldV1 } from '../../../src/host/world/SqliteInitialPitchHandHoldStore';
import { readInitialOwnedJointControlPreparation } from '../../../src/host/world/InitialOwnedJointControlPreparationFromSqlite';
import { readInitialCoupledMeasuredBatControlPreparation } from '../../../src/host/world/InitialMeasuredBatControlFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { queryControlledPitchWorldV1,queryControlledPitchWorldWithHoldRenewalV1 } from '../../../src/core/sim/pitch/ControlledPitchWorldV1';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';

const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw new Error('requires owned body Native directory and NEW output directory');
const input=resolve(inputArg),output=resolve(outputArg),original=resolve(input,'match.sqlite'),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(original),wal:existsSync(original+'-wal')&&readFileSync(original+'-wal').length?sha(original+'-wal'):null});
const beforeInput=durable(),report=JSON.parse(readFileSync(resolve(input,'native-report.json'),'utf8'));
strictEqual(report.bodyReferenceOwned,true);strictEqual(report.motionIssued,false);
mkdirSync(output);const path=resolve(output,'match.sqlite'),stage=resolve(output,'input-snapshot.sqlite');copyFileSync(original,stage);
if(beforeInput.wal)copyFileSync(original+'-wal',stage+'-wal');
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),inputDb=new sqlite.DatabaseSync(stage,{readOnly:true});
try{await sqlite.backup(inputDb,path);}finally{inputDb.close();}deepStrictEqual(durable(),beforeInput);
const bodyRequest=JSON.parse(readFileSync(resolve(input,'request.json'),'utf8')),bodyPreparation=readInitialCoupledMeasuredBatControlPreparation(path,bodyRequest);
deepStrictEqual(bodyPreparation,JSON.parse(readFileSync(resolve(input,'preparation.json'),'utf8')));
const db=new sqlite.DatabaseSync(path),census=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
  createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')]);
const before=census();strictEqual(before.length,73);
const sources=new Map<string,unknown>(),owner=openSqliteInitialPitchHandHoldStore(path,{readAcceptedHandHold:id=>sources.get(id)??null});
try{
  strictEqual(owner.accept('missing').kind,'pending');deepStrictEqual(census(),before);
  const source:AcceptedInitialPitchHandHoldV1={sourceId:'authored-coupled-body:pitcher-hand-hold',sourceVersion:'explicit-resting-endpoint-successor-v1',
    capability:'owned_initial_pitch_hand_hold_v1',operationReference:bodyRequest.decisionReference,throughTick:bodyRequest.throughTick};
  for(const [name,change] of [
    ['expired-scene',(s:any)=>{s.throughTick+=10_000_000;}],
    ['bad-operation',(s:any)=>{s.operationReference.sourceHash='0'.repeat(64);} ],
    ['endpoint-injection',(s:any)=>{s.handCenter={x:0,y:0,z:0};}],
  ] as const){const s=structuredClone(source);Object.assign(s,{sourceId:source.sourceId+':'+name});change(s);sources.set(s.sourceId,s);
    throws(()=>owner.accept(s.sourceId));deepStrictEqual(census(),before);}
  sources.set(source.sourceId,source);const hold=owner.accept(source.sourceId);if(hold.kind!=='initial_pitch_hand_hold_renewal_v1')throw new Error('actual hand hold missing');
  strictEqual(hold.commandOwned,true);strictEqual(hold.motionIssued,false);strictEqual(hold.predecessorChanged,false);strictEqual(hold.request.fromTick,10787305);
  const request={batter:bodyRequest,pitcherHandHoldReference:reference(initialPitchHandHoldTable,hold)},joint=readInitialOwnedJointControlPreparation(path,request);
  strictEqual(joint.allDeclaredControlLeasesCoverThroughTick,true);strictEqual(joint.motionIssued,false);deepStrictEqual(joint.batterControl,bodyPreparation.control);
  const component={...joint.physicalContext,throughTick:joint.throughTick};
  throws(()=>queryControlledPitchWorldV1(component),/finite control/);
  const physical=queryControlledPitchWorldWithHoldRenewalV1(component,hold.request);if(physical.kind==='unresolved')throw new Error(physical.reason);
  strictEqual(physical.moment.ball.tick>=hold.request.fromTick,true);
  deepStrictEqual(physical.moment.ball,createSourceFreeBallKernel(component.descriptor).evaluateAt(physical.moment.elapsedSeconds,'incoming').moment.ball);
  const reopen=openSqliteInitialPitchHandHoldStore(path);try{deepStrictEqual(reopen.read(source.sourceId),hold);deepStrictEqual(reopen.accept(source.sourceId),hold);}finally{reopen.close();}
  deepStrictEqual(census().filter(r=>r[0]!==initialPitchHandHoldTable),before);strictEqual(census().length,74);
  const saved=census(),row=db.prepare('SELECT snapshot_json FROM '+initialPitchHandHoldTable+' WHERE source_id=?').get(source.sourceId)!;
  const corrupt=JSON.parse(String(row.snapshot_json));corrupt.initialHand.position.x+=1;
  db.prepare('UPDATE '+initialPitchHandHoldTable+' SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(corrupt),source.sourceId);
  try{throws(()=>owner.read(source.sourceId));}finally{db.prepare('UPDATE '+initialPitchHandHoldTable+' SET snapshot_json=? WHERE source_id=?').run(String(row.snapshot_json),source.sourceId);}
  deepStrictEqual(owner.read(source.sourceId),hold);deepStrictEqual(census(),saved);deepStrictEqual(durable(),beforeInput);
  const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value),{flag:'wx'});
  save('source.json',source);save('owned-hand-hold.json',hold);save('request.json',request);save('preparation.json',joint);
  save('hand-component-query.json',{scope:'PITCH_HAND_AND_ORIGINAL_STATIC_SCENE_COMPONENT_ONLY',batterBatInteractionChecked:false,fullWorldAdvanceAllowed:false,physical});
  save('native-report.json',{status:'PASS_NATIVE_OWNED_PITCH_HAND_SUCCESSOR_AND_JOINT_PREPARATION',ownerMocks:false,
    bodyReferenceOwned:true,pitcherSuccessorCommandOwned:true,originalTablesUnchanged:true,totalTables:74,callbackFreeReopen:true,
    originalPitcherDeadlineTick:hold.request.fromTick,successorThroughTick:hold.request.throughTick,throughTick:joint.throughTick,
    predecessorChanged:false,endpointInjectionRefused:true,expiredSceneRefused:true,modifiedSnapshotRefused:true,corruptionRestoredExactly:true,
    originalBallRootPreserved:true,handColliderCheckedAfterOriginalDeadline:true,legacyExpiryGuardRetained:true,
    batterBatInteractionChecked:false,fullWorldAdvanceAllowed:false,physicalExecutionAdmitted:false,motionIssued:false,workloadTotalAdmitted:false,fullMatchVerified:false});
  process.stdout.write('PASS_NATIVE_OWNED_PITCH_HAND_SUCCESSOR_AND_JOINT_PREPARATION\n');
}finally{owner.close();db.close();}
