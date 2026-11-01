import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {writeFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),user=process.argv[3]?await readFile(process.argv[3]):null,
 source=user?JSON.parse(user.toString('utf8').replace(/^\uFEFF/,'')):null,roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],
 teams=source?.configuration.teams??[0,1].map(t=>({id:'team-'+t,name:'Team '+t,battingOrder:Array.from({length:9},(_,i)=>t+'-b'+i),pitcherId:t+'-p0',
  defense:Object.fromEntries(roles.map((r,i)=>[r,i===0?t+'-p0':t+'-b'+(i-1)]))})),
 roster=source?new Map(source.configuration.physicalRoster.entries.map(e=>[e.playerId,e])):null,
 players=source?source.configuration.players.map(p=>({...p,...(roster.get(p.playerId)?.traitProfile?{traitProfile:roster.get(p.playerId).traitProfile}:{})})):
 [0,1].flatMap(t=>[...Array.from({length:9},(_,i)=>({playerId:t+'-b'+i,name:'Player '+t+'-'+i,heightMeters:1.8,bats:i%3===0?'L':'R'})),{playerId:t+'-p0',name:'Pitcher '+t,heightMeters:1.88,bats:'R'}]),
 decode=source?new Function(await readFile('tools/browser-bridge/measured-bat-library-v1.js','utf8')+';return KneekuraMeasuredBatLibrary.decode;')():null,
 clips=source?decode(await readFile('docs/demos/measured-bat-library-v1.json','utf8')).clips:JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')).clips;
let fieldWallMs=0;
const api=new Function('_captureV113',code.replace('function simulateLiveFieldPlayV1(raw) {','function simulateLiveFieldPlayV1(raw) {\n _captureV113(raw);')+';return KneekuraNativeMatchCore;')(
 input=>{writeFileSync(resolve(out,'last-field-input.json'),JSON.stringify(input));fieldWallMs=performance.now();}),
 host=api.createLiveBaseballMatchV1({seed:source?.numericSeed??2468,innings:9,teams,players,measuredClips:clips,...(source?.configuration.park?{park:source.configuration.park}:{})}),
 started=performance.now(),report={pass:false,sourceCoreSha256:createHash('sha256').update(code).digest('hex'),
  inputSha256:user?createHash('sha256').update(user).digest('hex'):null,diagnosticBeforeFieldCaptureOnly:true,pitches:0,contacts:0,fieldPlays:0,halfChanges:0,
  maximumPitchWallMs:0,maximumFieldWallMs:0,maximumPitches:source?1600:700,finished:false,match:host.inspect().match};
const flush=()=>{report.elapsedMs=performance.now()-started;writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
try{
 while(!report.finished&&report.pitches<report.maximumPitches){
  const n=report.pitches,command=source?.pitches[n]?.command??(source?{...source.pitches.at(-1).command,batting:'auto',pitchType:'auto',location:'auto'}:
   {managedTeam:0,batting:n%7===0?'power':n%5===0?'contact':'balanced',pitchType:'auto',location:'auto'}),
   previous=report.match,at=performance.now();fieldWallMs=0;
  appendFileSync(resolve(out,'progress.jsonl'),JSON.stringify({phase:'before',pitch:n+1,inning:previous.inning,half:previous.half,command})+'\n');
  const r=host.issuePitch(command),pitchWallMs=performance.now()-at;
  report.pitches++;report.maximumPitchWallMs=Math.max(report.maximumPitchWallMs,pitchWallMs);
  if(r.play.contact)report.contacts++;
  if(r.play.field){report.fieldPlays++;assert(r.play.field.end.complete,'incomplete defense');report.maximumFieldWallMs=Math.max(report.maximumFieldWallMs,performance.now()-fieldWallMs);}
  if(r.match.inning!==previous.inning||r.match.half!==previous.half)report.halfChanges++;
  assert(r.match.score.away>=previous.score.away&&r.match.score.home>=previous.score.home);assert(r.frames.every(f=>Number.isSafeInteger(f.tick)));
  report.match=r.match;report.finished=r.finished;flush();
  appendFileSync(resolve(out,'progress.jsonl'),JSON.stringify({phase:'after',pitch:report.pitches,inning:r.match.inning,half:r.match.half,outs:r.match.outs,
   classification:r.play.classification,pitchWallMs,elapsedMs:report.elapsedMs})+'\n');
  if(report.pitches%50===0)console.log(JSON.stringify({pitches:report.pitches,inning:r.match.inning,half:r.match.half,score:r.match.score,elapsedMs:report.elapsedMs}));
 }
 assert(report.finished,'pitch safety limit without nine-inning completion');assert(report.match.inning>=9);assert(report.contacts>5);assert(report.halfChanges>=16);
 assert.equal(report.contacts,report.fieldPlays);report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}finally{flush();}
console.log(JSON.stringify(report));
