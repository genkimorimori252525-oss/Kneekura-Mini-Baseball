import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='docs/verification/releases/v104-investigation',sha=b=>createHash('sha256').update(b).digest('hex'),
 a=JSON.parse(await readFile(dir+'/catch-eye-v102-r2/report.json')),b=JSON.parse(await readFile(dir+'/catch-eye-v103-r2/report.json')),
 snapshot=JSON.parse(await readFile('../../outputs/v103-candidate-2/build-sources-v103.json')),
 roster=JSON.parse(await readFile('docs/demos/live-game-roster-v98.json'));
for(const report of[a,b]){
 assert.equal(report.pass,true);assert.deepEqual(report.pageErrors,[]);assert.equal(report.cases.length,3);
 assert.equal(sha(await readFile(report.file)),report.sourceSha256);
 for(const c of report.cases){
  const height=roster.entries.find(e=>e.playerId===c.id).heightMeters;
  for(const row of c.rows){
   assert(row.bodyToGlove<=c.spec.gloveReachMeters+1e-8,'sampled glove exceeded current sphere');
   assert.equal(row.camera.eye.x,row.actorPosition.x);assert.equal(row.camera.eye.z,row.actorPosition.z);
   assert.equal(row.camera.eye.y,row.actorPosition.y+height*.92);
  }
 }
}
const comparisons=a.cases.map(c=>{
 const next=b.cases.find(d=>d.item.id===c.item.id);assert(next);assert.deepEqual(c.caught,next.caught);assert.deepEqual(c.contact,next.contact);
 return {caseId:c.item.id,captureFactUnchanged:true,contactFactUnchanged:true,playerId:c.id,
  contactBallHeightMeters:c.contact.position.y,catchAtSeconds:c.caught.elapsedSeconds,
  eyeHeightMeters:c.rows[0].camera.eye.y,sampledMaximumBodyToGloveMeters:Math.max(...c.rows.map(r=>r.bodyToGlove)),
  currentReachMeters:c.spec.gloveReachMeters,preCatchSamplesOutsideView:c.rows.filter(r=>r.relativeToCatchSeconds<0&&!r.visible).length};
});
for(const[path,hash]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(path)),hash,'v103 captured input unchanged: '+path);
const result={pass:true,scope:'INVESTIGATION_NOT_PRODUCT_FIX',comparisons,capturedV103SourcesUnchanged:Object.keys(snapshot.inputs).length,
 exactUserScenarioIdentified:false,bodyAnatomicalReachValidated:false,notes:'Reach assertion concerns sampled current-model spheres only; contact/catch coordinates come from exact facts.'};
await writeFile(dir+'/comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:true,cases:comparisons.length,capturedV103SourcesUnchanged:result.capturedV103SourcesUnchanged,scope:result.scope}));
