import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(code.replace('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(),
 base=JSON.parse(await readFile('docs/verification/cooperative-defense-v120/performance/close-first-weak-input.json','utf8')),rows=[];
let found=null;
const refined=process.argv.includes('--refined');
for(const z of refined?[35.5,36,36.5,35,37]:[32,34,36])for(const reaction of refined?[.3,.4,.5,.2,.6]:[.8,1,.4,0])for(const x of refined?[.8,1,1.2,1.4,1.6]:[.5,1.2]){
 if(found)break;const input=structuredClone(base),rear=input.fielders.find(f=>f.defensivePosition==='SS');
 rear.position.x=x;rear.position.z=z;rear.reactionSeconds=reaction;
 const at=performance.now();let result;
 try{result=api.simulate(input);}catch(error){rows.push({z,reaction,x,error:String(error)});continue;}
 const dives=result.diagnostics.athleticDecisionsV115.filter(a=>a.kind==='dive'),touches=result.facts.filter(f=>f.kind==='glove_contact'),
  secured=result.facts.find(f=>f.kind==='catch_secured'),ok=result.end.complete&&dives.some(a=>a.playerId==='f3')&&dives.some(a=>a.playerId==='f5')
   &&touches[0]?.playerId==='f3'&&secured?.playerId==='f5';
 rows.push({z,reaction,x,wallMs:performance.now()-at,end:result.end,dives,secured,firstTouch:touches[0],ok});
 console.log(JSON.stringify(rows.at(-1)));
 if(ok){found={input,result};await writeFile(resolve(out,'first-failed-rear-dive-secured.json'),JSON.stringify(found));
  const both=structuredClone(input);both.fielders.find(f=>f.playerId==='f5').catchRetention.centerRetentionCapacityJ=.01;
  const bothResult=api.simulate(both);await writeFile(resolve(out,'both-failed.json'),JSON.stringify({input:both,result:bothResult}));}
 if(!result.end.complete)await writeFile(resolve(out,'incomplete-'+rows.length+'.json'),JSON.stringify({input,result}));
}
await writeFile(resolve(out,'report.json'),JSON.stringify({found:!!found,sourceCoreSha256:createHash('sha256').update(code).digest('hex'),
 parameterInterventionsOnly:['SS.position.x','SS.position.z','SS.reactionSeconds'],retentionBoundaryInterventionNotNaturalFrequency:true,rows},null,2)+'\n');
assert(found,'No true sequential dive capture fixture found in this declared grid');
