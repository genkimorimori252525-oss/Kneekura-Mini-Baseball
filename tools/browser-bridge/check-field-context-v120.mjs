import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const folder=resolve(process.argv[2]),out=resolve(process.argv[3]),extra=process.argv.includes('--extra');assert(folder&&out);
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),build=JSON.parse(await readFile(folder+'/build-report-v120.json','utf8')),
 code=await readFile('dist/native-match-core-browser.js','utf8'),seam='return __toCommonJS(browser_exports);';
assert.equal(sha(code),build.sourceCoreSha256);assert.equal(code.split(seam).length,2);
const api=new Function(code.replace(seam,'return {...__toCommonJS(browser_exports),simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(),
 report={pass:false,sourceCoreSha256:sha(code),cases:[],contrasts:[]};
const summary=r=>({end:r.end,finalRunners:r.finalRunners,actions:r.diagnostics.athleticDecisionsV115,
 facts:r.facts.filter(f=>['catch_secured','throw_release','controlled_base_contact','controlled_runner_tag','runner_base_touch'].includes(f.kind)),
 choices:r.diagnostics.aiTelemetry.individualDecisionsV118,communication:r.diagnostics.aiTelemetry.communicationV118,
 cancellations:r.diagnostics.throwEffortCancellationsV103});
async function run(name,input){
 const before=JSON.stringify(input),t=performance.now(),r=api.simulate(input),ms=performance.now()-t;
 await writeFile(out+'/'+name+'.json',JSON.stringify({name,input,result:r})+'\n');
 assert.equal(JSON.stringify(input),before);assert(r.end.complete,name+' complete');assert(!r.diagnostics.unresolvedDetail,name+' unresolved');
 assert.equal(r.diagnostics.aiTelemetry.individualDecisionsV118.length,9);assert(r.diagnostics.aiTelemetry.communicationV118.entries<=256);
 for(const fact of r.facts.filter(f=>f.kind==='throw_release'))for(const a of (r.diagnostics.athleticDecisionsV115??[]).filter(a=>a.playerId===fact.playerId&&a.fromSeconds<=fact.elapsedSeconds))assert(fact.elapsedSeconds>=a.throughSeconds,'release before recovery');
 const proof=summary(r);await writeFile(out+'/'+name+'.json',JSON.stringify({name,input,result:r})+'\n');
 report.cases.push({name,ms,inputSha256:sha(before),proof});console.log(JSON.stringify({name,ms,end:r.end,outs:r.ruleFacts.controlledBaseContacts.length,throws:proof.facts.filter(f=>f.kind==='throw_release').map(f=>({id:f.playerId,base:f.base}))}));return r;
}
try{
 const root='docs/verification/defense-reference-audit-2026-10-25/context-contrasts/';
 for(const name of extra?[]:['runner-first-rf-ground-authored','runner-third-lf-fly-authored','vacant-first-cover-authored','vacant-first-cover-throw-error-0']){
  const raw=JSON.parse(await readFile(root+name+'.json','utf8')).input,input={...raw,defenseDecisionModeV118:'individual',recordDecisionTraceV118:true};
  const result=await run(name,input);
  if(name==='vacant-first-cover-authored'){
   const slow=structuredClone(input);slow.fielders.find(f=>f.defensivePosition==='P').reactionSeconds+=.5;
   const changed=await run(name+'-slow-P',slow);report.contrasts.push({name:'pitcher-reaction-only',baseline:name,changed:name+'-slow-P',changedField:'P.reactionSeconds',factsChanged:JSON.stringify(changed.facts)!==JSON.stringify(result.facts)});
  }
 }
 const request=JSON.parse(await readFile('docs/verification/releases/v118/browser-c3/second_force_glove-1200-request.json','utf8')),
  base=api.buildLiveFieldPlayInputV95(request.fieldInput);
 for(const [name,x]of [['dp463',8],['dp643',-8],['dp543',-20]]){
  if(extra&&name==='dp463')continue;const input=structuredClone(base);input.ball.ball.velocity.x=x;input.recordDecisionTraceV118=true;
  if(name!=='dp463')input.fielders.find(f=>f.defensivePosition==='2B').transferSeconds=.1;
  if(name==='dp543'){input.ball.ball.position={x:-18,y:.2,z:23};input.ball.ball.velocity={x:-2,y:-.3,z:1};}
  // These are input interventions, never commands assigning a 4-6-3 route.
  const result=await run(name,input),again=api.simulate(input);
  for(const key of ['facts','ruleFacts','end','finalRunners'])assert.deepEqual(again[key],result[key],name+' repeat '+key);
  if(extra&&name==='dp543'){const slow=structuredClone(input);slow.runners.find(r=>r.initialBase===0).topSpeedMps*=.65;await run('dp543-slower-batter',slow);}
  if(name==='dp463'){
   const secure=result.facts.find(f=>f.kind==='catch_secured'),release=result.facts.find(f=>f.kind==='throw_release');
   assert(release.elapsedSeconds-secure.elapsedSeconds<.5);assert(result.diagnostics.throwEffortCommandsV103.some(c=>c.releaseStyleV110==='glove_toss'));
  }
 }
 const rf=JSON.parse(await readFile(root+'runner-first-rf-ground-authored.json','utf8')).input,
  input={...rf,defenseDecisionModeV118:'individual',recordDecisionTraceV118:true},rfid=input.fielders.find(f=>f.defensivePosition==='RF').playerId;
 const variants={weak_arm:r=>{r.fielders.find(f=>f.playerId===rfid).throwSpeedMps*=.7;},
  cautious:r=>{const f=r.fielders.find(f=>f.playerId===rfid);f.fieldingCognition={...f.fieldingCognition,cautious:true,pursuitCostWeight:2};},
  low_trust:r=>{for(const a of r.fielders)a.fieldRelationshipsV99=r.fielders.filter(b=>a!==b).map(b=>({toPlayerId:b.playerId,trust:0,coordination:0}));},
  park:r=>{r.field.fenceRadiusMeters-=5;}};
 for(const [name,change]of extra?[]:Object.entries(variants)){const altered=structuredClone(input);change(altered);await run('rf-'+name,altered);report.contrasts.push({name,baseline:'runner-first-rf-ground-authored',changed:'rf-'+name});}
 if(extra){const gap=api.buildAverageFieldCaseV95({caseId:'RF_gap_runner_second',seed:2025,bats:'R',parkRadiusMeters:110}).input;gap.recordDecisionTraceV118=true;await run('gap-110m',gap);const small=structuredClone(gap);small.field.fenceRadiusMeters=100;await run('gap-100m',small);const prior=JSON.parse(await readFile('docs/verification/releases/v116/athletic-advance/contrast.json','utf8'));for(const row of prior){const input=structuredClone(row.input);input.defenseDecisionModeV118='individual';input.recordDecisionTraceV118=true;await run('recovery-'+row.recovery,input);}}
 report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,cases:report.cases.length,error:report.error}));
