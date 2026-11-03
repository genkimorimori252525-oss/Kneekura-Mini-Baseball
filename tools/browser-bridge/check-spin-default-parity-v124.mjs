import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const folder=resolve(process.argv[2]),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const sha=source=>createHash('sha256').update(source).digest('hex'),prior=JSON.parse(await readFile('docs/verification/traits-spin-continuation-v123/integrity.json','utf8')),
 artifact=prior.artifacts.find(a=>a.path.includes('ばせぼーる')),html=await readFile(artifact.path,'utf8');
assert.equal(sha(html),artifact.sha256);
const matches=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.includes('var KneekuraNativeMatchCore =')),
 oldCode=matches.map(s=>s.endsWith('\n')?s.slice(0,-1):s).find(s=>sha(s)===prior.sourceCoreSha256);
assert(oldCode,'the exact frozen V123 Core must be recovered');
const code=await readFile('dist/native-match-core-browser.js','utf8'),build=JSON.parse(await readFile(resolve(folder,'build-report-v124.json'),'utf8'));
assert.equal(sha(code),build.sourceCoreSha256);
const oldApi=new Function(oldCode+';return KneekuraNativeMatchCore;')(),api=new Function(code+';return KneekuraNativeMatchCore;')(),
 roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],teams=[0,1].map(t=>({id:'t'+t,name:'T'+t,
  battingOrder:Array.from({length:9},(_,i)=>t+'-b'+i),pitcherId:t+'-p0',defense:Object.fromEntries(roles.map((r,i)=>[r,i===0?t+'-p0':t+'-b'+(i-1)]))})),
 players=[0,1].flatMap(t=>[...Array.from({length:9},(_,i)=>({playerId:t+'-b'+i,name:'test',heightMeters:1.8,bats:i%3===0?'L':'R'})),{playerId:t+'-p0',name:'test',heightMeters:1.88,bats:'R'}])
  .map(p=>({...p,physical:{...api.LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,maximumSweetSpotSpeedMps:45,targetSweetSpotSpeedMps:30,motorLatencySeconds:.02,timingStdSeconds:.04,aimStdMeters:.1}})),
 clips=JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')).clips,configuration={seed:31,innings:1,teams,players,measuredClips:clips},
 old=oldApi.createLiveBaseballMatchV1(configuration),current=api.createLiveBaseballMatchV1(configuration),records=[];
const started=performance.now();
for(const batting of ['take','take','take','balanced','power']){
 const command={managedTeam:0,batting,pitchType:'auto',location:'auto'},a=JSON.stringify(old.issuePitch(command)),b=JSON.stringify(current.issuePitch(command));
 assert.equal(b,a,'V123/V124 ordinary full-record mismatch at pitch '+(records.length+1));records.push({batting,sha256:sha(a),bytes:Buffer.byteLength(a)});
}
assert.deepEqual(current.inspect().match,old.inspect().match);
const report={pass:true,boundary:'FROZEN_V123_TO_V124_ORDINARY_HOST_FULL_RECORD',previousCoreSha256:prior.sourceCoreSha256,sourceCoreSha256:sha(code),pitches:records.length,records,elapsedMs:performance.now()-started};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
