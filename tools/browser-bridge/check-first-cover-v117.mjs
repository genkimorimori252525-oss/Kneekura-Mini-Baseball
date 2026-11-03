import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const html=await readFile('../../outputs/ばせぼーるlv116_TBD_vs_LAD_動作検証と先読み生成版.html','utf8'),
 code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore =')).slice(0,-1),
 original=JSON.parse(await readFile('docs/verification/releases/v117/replay-v116-2/field-input.json','utf8')),
 api=c=>new Function(c.replace('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(),
 report={pass:false,diagnosticOnly:true,noProductOrUserDataEdits:true,cases:[]};
try{
 for(const [label,threshold,quick,single,moveSecond,movePitcher]of [
  ['original',.25,false,false,false],['attempt-only-.35',.35,false,false,false],['attempt-only-.4',.4,false,false,false],
  ['quick-single',.25,true,true,false],['quick-single-second-away',.25,true,true,true],
  ['quick-single-pitcher-near',.25,true,true,true,true],
 ]){
  const input=structuredClone(original);if(quick){const f=input.fielders.find(f=>f.defensivePosition==='1B');f.reactionSeconds=.13;f.fieldingCognition.decisionSeconds=.035;}
  if(single)input.runners=input.runners.filter(r=>r.initialBase===0);
  if(moveSecond){const f=input.fielders.find(f=>f.defensivePosition==='2B');f.position={...f.position,x:-8,z:44};}
  if(movePitcher){const f=input.fielders.find(f=>f.defensivePosition==='P');f.position={...f.position,x:7,z:19};}
  const frozen=JSON.stringify(input),variant=code.replace('maximumLateSeconds: 0.25','maximumLateSeconds: '+threshold),
   result=api(variant).simulate({...input,recordInitialMovementV98:true}),pid=input.fielders.find(f=>f.defensivePosition==='P').playerId,
   first=input.fielders.find(f=>f.defensivePosition==='1B').playerId;
  assert.equal(JSON.stringify(input),frozen);assert(result.end.complete);
  const row={label,threshold,quick,single,moveSecond,movePitcher:!!movePitcher,end:result.end,firstCatch:result.facts.find(f=>f.kind==='catch_secured'),
   firstBasemanIntercept:result.frames.some(f=>f.fielders.find(a=>a.playerId===first).intent==='intercept'),
   pitcherCoverFirst:result.frames.some(f=>{const a=f.fielders.find(a=>a.playerId===pid);return a.intent==='base_cover'&&a.targetBase===1;}),
   facts:result.facts.filter(f=>['catch_secured','throw_release','controlled_base_contact','runner_base_touch'].includes(f.kind)),
   roleTransitions:result.diagnostics.aiTelemetry.roleTransitions,
   forceOuts:result.ruleFacts};
  report.cases.push(row);
 }
 const by=label=>report.cases.find(c=>c.label===label),first=original.fielders.find(f=>f.defensivePosition==='1B').playerId,
  pitcher=original.fielders.find(f=>f.defensivePosition==='P').playerId,right=original.fielders.find(f=>f.defensivePosition==='RF').playerId;
 assert.equal(by('original').firstCatch.playerId,right);assert.equal(by('original').firstBasemanIntercept,false);
 for(const label of ['attempt-only-.35','attempt-only-.4']){assert(by(label).firstBasemanIntercept);assert.equal(by(label).firstCatch.playerId,right);}
 for(const label of ['quick-single','quick-single-second-away','quick-single-pitcher-near'])assert.equal(by(label).firstCatch.playerId,first);
 assert(by('quick-single').facts.some(f=>f.kind==='throw_release'&&f.playerId===first&&f.base===1));
 assert(by('quick-single-second-away').pitcherCoverFirst);
 assert(by('quick-single-second-away').facts.some(f=>f.kind==='controlled_base_contact'&&f.playerId===first&&f.base===1));
 assert(by('quick-single-pitcher-near').pitcherCoverFirst);
 assert(by('quick-single-pitcher-near').facts.some(f=>f.kind==='throw_release'&&f.playerId===first&&f.receiverPlayerId===pitcher&&f.base===1));
 assert(by('quick-single-pitcher-near').facts.some(f=>f.kind==='controlled_base_contact'&&f.playerId===pitcher&&f.base===1));
 report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
report.coreSha256=createHash('sha256').update(code).digest('hex');await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,error:report.error,cases:report.cases.map(c=>({label:c.label,firstCatch:c.firstCatch?.playerId,intercept:c.firstBasemanIntercept,pitcherCoverFirst:c.pitcherCoverFirst,end:c.end,
 throws:c.facts.filter(f=>f.kind==='throw_release').map(f=>({from:f.playerId,to:f.receiverPlayerId,base:f.base})),controls:c.facts.filter(f=>f.kind==='controlled_base_contact')}))}));
