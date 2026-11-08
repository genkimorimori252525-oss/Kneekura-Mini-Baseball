import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync,mkdirSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { readInitialMeasuredBatControlPreparation } from '../../../src/host/world/InitialMeasuredBatControlFromSqlite';
import { createCoupledHeldMeasuredBatBodyControlV1,createHeldToMeasuredBatControlV1,type CoupledHeldMeasuredBatBodyControlV1 } from '../../../src/core/sim/contact/HeldToMeasuredBatControlV1';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { withBodyCompositionTransaction } from '../../../src/host/world/BodyMaterializationSqliteOwnership';

const [decisionArg,prefixArg,outputArg]=process.argv.slice(2);if(!decisionArg||!prefixArg||!outputArg)throw new Error('requires original decision, prefix and NEW output directory');
const decisionDir=resolve(decisionArg),prefixDir=resolve(prefixArg),output=resolve(outputArg),path=resolve(decisionDir,'match.sqlite');mkdirSync(output);
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),databaseBefore=sha(path);
const durableContent=()=>({main:sha(path),wal:existsSync(path+'-wal')&&readFileSync(path+'-wal').length>0?sha(path+'-wal'):null});
const beforeDurableContent=durableContent();
// The original production Native owner authenticates the present decision and
// all old sources. The new pelvis proposal below is deliberately NOT admitted.
const prefix=readInitialMeasuredBatControlPreparation(path,JSON.parse(readFileSync(resolve(prefixDir,'request.json'),'utf8')));
deepStrictEqual(prefix,JSON.parse(readFileSync(resolve(prefixDir,'preparation.json'),'utf8')));
const expected=JSON.parse(readFileSync(resolve(decisionDir,'expected.json'),'utf8')),decision=expected.records.at(-1);
strictEqual(decision.calculation.commitment.action,'SWING');deepStrictEqual(prefix.control.measured,decision.calculation.commitment.sampledTrajectoryV1);
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new sqlite.DatabaseSync(path,{readOnly:true});
let originalBody;
try{
  originalBody=withBodyCompositionTransaction(db,false,()=>playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(prefix.bodyReference.sourceId));
  if(!originalBody)throw new Error('original materialized body missing');
  strictEqual(hash(originalBody.source),prefix.bodyReference.sourceHash);strictEqual(hash(originalBody),prefix.bodyReference.snapshotHash);
}finally{db.close();}
const dataPath=resolve('docs/demos/measured-batter-pelvis-v1.json'),data=JSON.parse(readFileSync(dataPath,'utf8'));
strictEqual(data.authority,'ORIGINAL_HIP_JOINT_CENTERS_NOT_MEASURED_BODY_COM_OR_PLAYER_CALIBRATION');
strictEqual(sha(resolve('docs/demos/measured-bat-motions.json')),data.originalBatDatasetSha256);
const clip=data.clips.find((c:any)=>c.clipId===prefix.control.measured.provenance.clipId);if(!clip)throw new Error('original same-clip hip pairs missing');
strictEqual(clip.batSourceSha256,prefix.control.measured.provenance.sourceSha256);
const control=prefix.control,measured=control.measured,last=measured.frames.at(-1)!;
strictEqual(measured.transform.scale,1);
const end=measured.startTick+(last.tick-measured.frames[0].tick)/measured.sourceTicksPerSecond/measured.playbackRate*1e6;
const throughTick=Math.min(control.initial.throughTick,Math.ceil(end)-1),center=control.body.bodyOrigin;
const indexFor=(role:string)=>{
  const p=originalBody.actor.primitives.find(p=>p.role===role);if(!p)throw new Error('original primitive missing');
  const at={x:center.x+p.offset.x,y:center.y+p.offset.y,z:center.z+p.offset.z};
  const indices=control.body.obstacles.flatMap((o,i)=>o.radiusM===p.radius&&o.center.x===at.x&&o.center.y===at.y&&o.center.z===at.z?[i]:[]);
  strictEqual(indices.length,1);return indices[0];
};
const input:CoupledHeldMeasuredBatBodyControlV1={version:'coupled_held_measured_bat_body_control_v1',bat:{...control,throughTick},
  bodyObstacleIndex:indexFor('body'),footObstacleIndices:[indexFor('left_foot'),indexFor('right_foot')],maximumLegReachM:originalBody.reach.maximumLegReachMeters,
  body:{version:'measured_pelvis_control_v1',startTick:control.initial.startTick,bridgeStartTick:control.bridgeStartTick,throughTick,initialCenter:center,
    // Explicit study envelope. Not an accepted person's vertical/postural
    // capability and not inferred from a ground locomotion speed rating.
    maximumSpeedMps:5,reference:{provenance:{clipId:clip.clipId,sourceSha256:data.archiveMemberSha256,batSourceSha256:clip.batSourceSha256},
      frames:clip.frames.map(({tick,leftHip,rightHip}:any)=>({tick,leftHip,rightHip})),startTick:measured.startTick,
      sourceTicksPerSecond:measured.sourceTicksPerSecond,ticksPerSecond:1000000,playbackRate:measured.playbackRate,
      transform:{rotation:measured.transform.rotation,translation:measured.transform.translation,scale:1}}}};
writeFileSync(resolve(output,'input.json'),JSON.stringify(input),{flag:'wx'});
try{
  throws(()=>createHeldToMeasuredBatControlV1(input.bat),/collision/);
  const model=createCoupledHeldMeasuredBatBodyControlV1(input);strictEqual(model.certificate.nativeAdmission,false);
  deepStrictEqual(model.input.bat.measured,control.measured);deepStrictEqual(model.input.bat.body.obstacles,control.body.obstacles);
  strictEqual(sha(path),databaseBefore);deepStrictEqual(durableContent(),beforeDurableContent);
  const report={status:'PASS_NATIVE_INPUT_COUPLED_GEOMETRY_STUDY',originalNativePrefixReauthenticated:true,ownerMocks:false,
    bodyReferenceOwned:false,originalMeasuredBatKeys:measured.frames.length,originalHipKeys:input.body.reference.frames.length,
    originalObstacleCount:control.body.obstacles.length,bodyObstacleIndex:input.bodyObstacleIndex,throughTick,
    certificate:model.certificate,studyBodySpeedCeilingMps:5,bodySpeedCeilingAuthority:'SYNTHETIC_STUDY_NOT_PLAYER_ASSESSMENT',
    requiresPitcherControlRenewal:true,physicalExecutionAdmitted:false,motionIssued:false,fullMatchVerified:false,databaseSha256:databaseBefore,
    bodyDatasetSha256:sha(dataPath),beforeDurableContent,durableContentUnchanged:true};
  writeFileSync(resolve(output,'study.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_INPUT_COUPLED_GEOMETRY_STUDY\n');
}catch(error){
  writeFileSync(resolve(output,'rejected-study.json'),JSON.stringify({status:'REJECTED_COUPLED_GEOMETRY_STUDY',error:error instanceof Error?error.message:String(error),
    motionIssued:false,physicalExecutionAdmitted:false,databaseUnchanged:sha(path)===databaseBefore,
    durableContentUnchanged:JSON.stringify(durableContent())===JSON.stringify(beforeDurableContent)},null,2)+'\n',{flag:'wx'});throw error;
}
