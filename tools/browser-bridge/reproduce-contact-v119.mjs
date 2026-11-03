import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const out=resolve(process.argv[2]),inputPath=process.argv[3],corePath=process.argv[4]??'../../outputs/v118-final-2/ばせぼーるlv118_TBD_vs_LAD_個人判断と守備連携版.html';
assert(inputPath,'Usage: node reproduce-contact-v119.mjs <out> <match.json> [core.js|game.html]');
mkdirSync(out,{recursive:true});
const bytes=readFileSync(inputPath),saved=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),raw=readFileSync(corePath,'utf8'),
 code=corePath.endsWith('.html')?[...raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore =')).replace(/\n$/,''):raw,
 sha=value=>createHash('sha256').update(value).digest('hex');
let pitch=0,queryCount=0,lastInput;
const write=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
assert(code.includes('if (uncertain?.kind === "unresolved")'));
const diagnostic=code.replace('function simulateLiveFieldPlayV1(raw) {','function simulateLiveFieldPlayV1(raw) { _captureInput(raw);')
 .replace('if (uncertain?.kind === "unresolved")','if (uncertain?.kind === "unresolved") _captureQuery(input, searches, proof);\n    if (uncertain?.kind === "unresolved")')
 .replace('field = simulateLiveFieldPlayV1(fieldInput);','field = simulateLiveFieldPlayV1(fieldInput); _captureResult(field);');
assert.notEqual(diagnostic,code);
const api=new Function('_captureInput','_captureQuery','_captureResult',diagnostic+';return KneekuraNativeMatchCore;')(
 value=>{lastInput=structuredClone(value);write('last-field-input.json',value);if(pitch===51)write('field-input.json',value);},
 (query,searches,proof)=>{queryCount++;write('query-input.json',query);write('query-search.json',{pitch,searches:searches.map(s=>({key:s.collider.key,result:s.result})),proof:proof?.diagnostic??null});},
 result=>{if(pitch===51){write('field-result.json',result);write('field-input.json',lastInput);} });
const roster=new Map(saved.configuration.physicalRoster.entries.map(e=>[e.playerId,e])),
 players=saved.configuration.players.map(p=>({...p,...(roster.get(p.playerId)?.traitProfile?{traitProfile:roster.get(p.playerId).traitProfile}:{})})),
 decode=new Function(readFileSync('tools/browser-bridge/measured-bat-library-v1.js','utf8')+';return KneekuraMeasuredBatLibrary.decode;')(),
 host=api.createLiveBaseballMatchV1({seed:saved.numericSeed,innings:saved.configuration.innings,teams:saved.configuration.teams,players,
 park:saved.configuration.park,measuredClips:decode(readFileSync('docs/demos/measured-bat-library-v1.json','utf8')).clips}),
 report={task:'MB-20261025-CONTACT-COORDINATION-V119',coreSha256:sha(code),inputSha256:sha(bytes),targetPitch:51,seed:saved.numericSeed,
 numericalQueries:0,priorPitches:0,priorExactMatch:true,targetComplete:false,elapsedMs:0};
const start=performance.now();
try{
 for(let i=0;i<51;i++){
  pitch=i+1;const command=saved.pitches[i]?.command??saved.pitches.at(-1).command;
  const at=performance.now(),result=host.issuePitch(command);
  if(i<50){const prior=saved.pitches[i];assert.equal(result.play.classification,prior.play.classification,'classification '+pitch);
   assert.equal(result.play.call,prior.play.call,'call '+pitch);assert.deepEqual(result.match,prior.match,'match '+pitch);report.priorPitches++;}
  if(pitch===51){report.targetComplete=result.play.field?.end.complete??true;report.end=result.play.field?.end;write('record-51.json',result);}
  writeFileSync(resolve(out,'progress.json'),JSON.stringify({pitch,wallMs:performance.now()-at,elapsedMs:performance.now()-start,match:result.match}));
 }
}catch(error){report.error=String(error.stack??error);report.cause=error.cause;report.stoppedAtPitch=pitch;
 report.reproduced=pitch===51&&report.error.includes('numerical_contact_refinement_required');if(!report.reproduced)process.exitCode=1;
}finally{report.numericalQueries=queryCount;report.elapsedMs=performance.now()-start;write('report.json',report);}
console.log(JSON.stringify({reproduced:report.reproduced??false,priorPitches:report.priorPitches,targetComplete:report.targetComplete,stoppedAtPitch:report.stoppedAtPitch,elapsedMs:report.elapsedMs,error:report.error?.split('\n')[0]}));
