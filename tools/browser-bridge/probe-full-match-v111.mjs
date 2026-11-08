import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';
const out=resolve(process.argv[2]||'docs/verification/releases/v111/full-match');await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(code+';return KneekuraNativeMatchCore;')(),
 clips=JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')).clips,
 roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],teams=[0,1].map(t=>({id:'team-'+t,name:'Team '+t,
  battingOrder:Array.from({length:9},(_,i)=>t+'-b'+i),pitcherId:t+'-p0',defense:Object.fromEntries(roles.map((r,i)=>[r,i===0?t+'-p0':t+'-b'+(i-1)]))})),
 players=[0,1].flatMap(t=>[...Array.from({length:9},(_,i)=>({playerId:t+'-b'+i,name:'Player '+t+'-'+i,heightMeters:1.8,bats:i%3===0?'L':'R'})),{playerId:t+'-p0',name:'Pitcher '+t,heightMeters:1.88,bats:'R'}]),
 host=api.createLiveBaseballMatchV1({seed:2468,innings:9,teams,players,measuredClips:clips}),start=performance.now(),
 report={pass:false,sourceCoreSha256:createHash('sha256').update(code).digest('hex'),pitches:0,contacts:0,fieldPlays:0,halfChanges:0,plans:0,walks:0};
let previous=host.inspect().match,finished=false,last;
const bounded=process.argv[3]==='bounded',limit=bounded?20:700,progress=resolve(out,'progress.jsonl');
try{
 while(!finished&&report.pitches<limit){
  appendFileSync(progress,JSON.stringify({phase:'before',pitch:report.pitches+1,inning:previous.inning,half:previous.half,balls:previous.balls,strikes:previous.strikes})+'\n');
  if(bounded){const current=host.inspect(),id=current.batterPlayerId,pid=current.pitcherPlayerId,defense=teams[1-(current.match.half==='top'?0:1)].defense;
   const trial=api.buildPitcherWorkbenchInputV77({players,pitcherId:pid,batterId:id,catcherId:defense.C,measuredClips:clips,
    seed:(2468+Math.imul(report.pitches+1,0x9e3779b9))>>>0,originTick:current.frame.tick,pitchType:'auto',location:'auto',
    pitchSituationV111:{balls:previous.balls,strikes:previous.strikes,outs:previous.outs,occupiedBases:{first:previous.bases.first!==null,second:previous.bases.second!==null,third:previous.bases.third!==null}}});
   writeFileSync(resolve(out,'last-pitch-input.json'),JSON.stringify({...trial,batting:report.pitches%7===0?'power':report.pitches%5===0?'contact':'balanced'}));}
  const n=report.pitches,r=host.issuePitch({managedTeam:0,batting:n%7===0?'power':n%5===0?'contact':'balanced',pitchType:'auto',location:'auto'});
  report.pitches++;assert(r.play.diagnostics.pitchTargetPlanV111);report.plans++;
  if(r.play.contact)report.contacts++;
  if(r.play.field){report.fieldPlays++;assert(r.play.field.end.complete,'incomplete defensive scope');}
  if(r.match.inning!==previous.inning||r.match.half!==previous.half)report.halfChanges++;
  if(r.play.classification==='walk')report.walks++;
  assert(r.match.score.away>=previous.score.away&&r.match.score.home>=previous.score.home);assert(r.frames.every(f=>Number.isSafeInteger(f.tick)));
  previous=r.match;finished=r.finished;last=r;
  appendFileSync(progress,JSON.stringify({phase:'after',pitch:report.pitches,classification:r.play.classification,elapsedMs:performance.now()-start})+'\n');
  if(report.pitches%50===0)console.log(JSON.stringify({pitches:report.pitches,inning:r.match.inning,half:r.match.half,score:r.match.score,elapsedMs:performance.now()-start}));
 }
 if(!bounded){assert(finished,'did not finish within 700 real pitches');assert(previous.inning>=9);assert(report.contacts>5);assert(report.halfChanges>=16);}
 else assert(report.pitches===limit||finished);
 assert.equal(report.contacts,report.fieldPlays);
 report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{report.match=previous;report.finished=finished;report.elapsedMs=performance.now()-start;await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
