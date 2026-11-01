import{readFileSync as read,writeFileSync as write}from'node:fs';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
const sha=v=>createHash('sha256').update(v).digest('hex'),json=p=>JSON.parse(read(p,'utf8')),root='docs/verification/spin-trial-v124/',
 snapshot=json(root+'review-sources-v126.json');
for(const[path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(read(path)),hash,'reviewed source changed '+path);
const ids={nativeMulti:'549b4396fa294ba4b43b078da89077f7',legacyMasteryExposure:'e0751eac77274b7e86150ca82c386448',
 nativePitch:'8fc2da3ad0de47ae8f4df13c30edc079',prefixAndOriginals:'495a93ec98ab4e1a852f280dc17c48d6',type:'5da6207068174fe99f054a3d67afef58'};
for(const[name,id]of Object.entries(ids)){const receipt=json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_'+id+'.json');
 assert.equal(receipt.result,'PASS',name);assert.equal(receipt.exit_code,0);assert.equal(sha(read(receipt.output_path)),receipt.output_sha256);}
const stages=read(root+'native-multi-v126-yield.SM125-stages.jsonl','utf8').trim().split('\n').map(s=>JSON.parse(s));
for(const name of['top-qualification-ready','back-qualification-ready','single-gold-inventory-ready','offline-gold-inventory-ready',
 'corrupt-top-preserves-backspin','corrupt-native-exposure-preserves-backspin'])assert(stages.some(s=>s.name===name),name);
const report={pass:true,boundary:'NATIVE_TWO_SKILL_MASTERY_AND_READ_PHASE_MILESTONE_NOT_ACTOR_MATCH_ADOPTION',
 reviewedFiles:Object.keys(snapshot.inputs).length,receipts:ids,trueNativeSkills:2,trueNativeContacts:6,
 calibration:'EXPLICIT_SYNTHETIC_FIXTURE_NOT_REAL_POPULATION',actorMatchAdoption:'NOT_VERIFIED',
 sourceCommitPushMergeDeploy:false,signAutomaticNaming:'DEFERRED_TO_PENNANT_IMPLEMENTATION',goalComplete:false};
write(root+'native-phase-v126-integrity.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
