import { createHash } from 'node:crypto';
import { readFileSync,mkdirSync,writeFileSync,appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual } from 'node:assert';
import { simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1 } from '../../src/integration/browser/LivePitchV1';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { createSourceFreeBallKernel } from '../../src/core/sim/ball/SourceFreeBallKernel';

const [datasetArg,outputArg,countArg='1000',catcherArg='compatibility']=process.argv.slice(2);
if(!datasetArg||!outputArg)throw new Error('requires measured-OBP-JSON path, NEW output directory, optional count');
const dataset=resolve(datasetArg),output=resolve(outputArg),count=Number(countArg);
if(!Number.isSafeInteger(count)||count<=0)throw new Error('positive finite count required');
if(!['compatibility','host'].includes(catcherArg))throw new Error('catcher model must be compatibility or host');
mkdirSync(output);
const bytes=readFileSync(dataset),sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex'),datasetSha256=sha(bytes),
  clips=JSON.parse(bytes.toString('utf8')).clips as LiveMeasuredClipV1[],si=LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
  catcher=catcherArg==='host'?{gloveSpeedMps:si.gloveSpeedMps,gloveReachMeters:si.gloveReachMeters,gloveRadiusMeters:si.gloveRadiusMeters,
    retentionCapacityJ:si.retentionCapacityJ,captureDissipationPowerW:si.captureDissipationPowerW,pocketRadiusMeters:.14}:undefined;
const failures:string[]=[],byClip:Record<string,{pitches:number;contacts:number;calls:number;unsupported:number}>={},
  byReason:Record<string,number>={},byCall:Record<string,number>={},byPitch:Record<string,number>={},byDirection:Record<string,number>={};
let contacts=0,calls=0,unsupported=0,thrown=0;
const started=Date.now();
writeFileSync(resolve(output,'configuration.json'),JSON.stringify({count,dataset,datasetSha256,calibration:si,catcher,catcherModel:catcherArg,physics:LIVE_MATCH_PHYSICS_V1,
  source:'LOCAL_CORE_PHYSICAL_EXPERIMENT_V1',notFullMatchAudit:true,notEmpiricalMLBOrNLBPopulation:true},null,2)+'\n',{flag:'wx'});
for(let i=0;i<count;i++){
  const input:LivePitchInputV1={originTick:1_000_000+i*2_000_000,seed:(1000+Math.imul(i+1,0x9e3779b9))>>>0,
    batter:{...si,heightMeters:1.8,bats:i%3===0?'L':'R'},pitcher:si,...(catcher?{catcher}:{}),measuredClips:clips,
    batting:i%11===0?'take':i%7===0?'power':i%5===0?'contact':'balanced',pitchType:'auto',location:'auto',physics:LIVE_MATCH_PHYSICS_V1};
  try {
    const result=simulateLivePitchV1(input),clip=byClip[result.clipId]??={pitches:0,contacts:0,calls:0,unsupported:0};clip.pitches++;
    byPitch[result.pitchType]=(byPitch[result.pitchType]??0)+1;
    if(result.contact){
      contacts++;clip.contacts++;strictEqual(result.call,null);strictEqual(result.contactMoment!.originTick,input.originTick);
      deepStrictEqual(result.contact!.ballCenter,result.contactMoment!.ball.position);
      const original=createSourceFreeBallKernel(result.diagnostics.sourceDescriptor).evaluateAt(result.contactMoment!.elapsedSeconds,'incoming');
      deepStrictEqual(original.moment,result.contactMoment);deepStrictEqual(original.orientation,result.contactOrientation);
      const outgoing={...result.contactMoment!,ball:{...result.contactMoment!.ball,velocity:result.contact.exitVelocity,spin:result.contact.exitSpin}},
        next=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:outgoing,
          throughElapsedSeconds:outgoing.elapsedSeconds+.025,profile:input.physics}).evaluateAt(outgoing.elapsedSeconds+.025);
      strictEqual(next.moment.originTick,input.originTick);
      const angle=Math.atan2(result.contact.exitVelocity.x,result.contact.exitVelocity.z)*180/Math.PI,
        direction=Math.abs(angle)<=45?'initial_forward_fair_sector':Math.abs(angle)>=135?'initial_backward_sector':'initial_side_foul_sector';
      byDirection[direction]=(byDirection[direction]??0)+1;
    }
    if(result.call){calls++;clip.calls++;byCall[result.call]=(byCall[result.call]??0)+1;
      strictEqual(result.frames.at(-1)!.ball.possessedBy,'catcher');strictEqual(result.frames.at(-1)!.ball.visible,false);
      strictEqual(result.endedAtTick,result.diagnostics.secureTick);}
    if(result.diagnostics.unsupportedReason){unsupported++;clip.unsupported++;
      const reason=result.diagnostics.unsupportedReason;byReason[reason]=(byReason[reason]??0)+1;
      const file='failure-'+String(i).padStart(4,'0')+'.json';failures.push(file);
      const {sampleBatAtTick:_,...stored}=result;
      writeFileSync(resolve(output,file),JSON.stringify({index:i,input:{...input,measuredClips:undefined},datasetSha256,result:stored},null,2)+'\n',{flag:'wx'});
    }
    appendFileSync(resolve(output,'pitch-records.ndjson'),JSON.stringify({index:i,seed:input.seed,side:input.batter.bats,batting:input.batting,
      pitchType:result.pitchType,clipId:result.clipId,call:result.call,contact:result.contact,contactMoment:result.contactMoment,
      contactOrientation:result.contactOrientation,endedAtTick:result.endedAtTick,unsupportedReason:result.diagnostics.unsupportedReason})+'\n');
  }catch(error){thrown++;const file='exception-'+String(i).padStart(4,'0')+'.json';failures.push(file);
    writeFileSync(resolve(output,file),JSON.stringify({index:i,input:{...input,measuredClips:undefined},datasetSha256,
      error:error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error)},null,2)+'\n',{flag:'wx'});}
  if((i+1)%100===0)process.stdout.write(JSON.stringify({completed:i+1,contacts,calls,unsupported,thrown,elapsedMs:Date.now()-started})+'\n');
}
strictEqual(sha(readFileSync(dataset)),datasetSha256);
const summary={status:unsupported||thrown?'FAIL_LOCAL_PITCH_FRONTIERS_REMAIN':'PASS_LOCAL_PITCH_POPULATION',count,contacts,calls,unsupported,thrown,
  byClip,byReason,byCall,byPitch,initialExitDirectionDiagnostics:byDirection,failures,datasetSha256,elapsedMs:Date.now()-started,
  fullMatchVerified:false,empiricalFoulDistributionVerified:false,notes:'Initial exit sectors are not final fair/foul rulings. No local failure is converted to an out or re-rolled.'};
writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify(summary)+'\n');if(unsupported||thrown)process.exitCode=1;
