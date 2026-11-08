import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const sourcePath='src/core/sim/fielding/LiveFieldRoleAssignmentV1.ts',source=await readFile(sourcePath),
 sha=b=>createHash('sha256').update(b).digest('hex'),pins=JSON.parse(await readFile('../../outputs/ばせぼーるlv117_TBD_vs_LAD_際どい打球の捕球試行版.html.bundle-inputs.json','utf8'));
assert.equal(sha(source),pins.inputs[sourcePath]);
const bundle=await build({entryPoints:[sourcePath],bundle:true,write:false,format:'cjs',platform:'node',target:'es2022',logLevel:'silent'}),module={exports:{}};
new Function('module','exports','require',bundle.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));
const api=module.exports,v=(x=0,y=0,z=0)=>({x,y,z}),b=19.39735322150937,
 bases={1:v(b,0,b),2:v(0,0,b*2),3:v(-b,0,b),4:v()},
 positions={P:v(0,0,18.44),C:v(0,0,-1.5),'1B':v(23,0,25),'2B':v(13,0,36),'3B':v(-23,0,25),SS:v(-13,0,36),LF:v(-46,0,76),CF:v(0,0,91),RF:v(46,0,76)},
 report={pass:false,scope:'ROLE_COST_ONLY_NOT_PHYSICAL_PLAY_OR_MLB_MEASUREMENTS',sourcePath,sourceSha256:sha(source),sourceCoreSha256:pins.entrySha256,cases:[]};
try{
 for(const label of ['base','second-away','pitcher-fast','displaced-catcher']){
  const actors=Object.entries(positions).map(([role,p])=>({playerId:role,defensivePosition:role,position:{...p},homePosition:{...p},velocity:v(),
   topSpeedMps:7.8,accelerationMps2:5,throwSpeedMps:34,remainingReactionSeconds:.2,pursuitCostWeight:1}));
  const actor=id=>actors.find(a=>a.playerId===id);
  if(label==='second-away')actor('2B').position=v(-8,0,44);
  if(label==='pitcher-fast'){actor('P').topSpeedMps=14;actor('P').accelerationMps2=10;}
  if(label==='displaced-catcher'){
   actor('C').position={...bases[1]};actor('P').position=v(0,0,-75);actor('2B').position=v(-65,0,-35);actor('SS').position=v(-65,0,40);
  }
  const input={actors,bases,ballPosition:positions['1B'],ballVelocity:v(),pickupPoint:positions['1B'],ballPhase:'held',
   threats:[{base:1,arrivalSeconds:4},{base:2,arrivalSeconds:8}],
   reservations:[{playerId:'1B',taskId:'holder',point:positions['1B'],intent:'hold',targetBase:null}],previous:[]},
   before=JSON.stringify(input),roles=api.assignLiveFieldRolesV1(input),cover=roles.find(r=>r.intent==='base_cover'&&r.targetBase===1),
   coverTask={taskId:'cover:1',point:bases[1],intent:'base_cover',targetBase:1,deadline:4,responsiblePositions:['1B'],supportingPositions:['P','2B']},
   cost=actors.filter(a=>a.playerId!=='1B').map(a=>({playerId:a.playerId,...api.liveFieldRoleCostV1(a,coverTask)}));
  assert.equal(JSON.stringify(input),before);assert.equal(new Set(roles.map(r=>r.playerId)).size,9);
  assert.equal(roles.filter(r=>r.intent==='base_cover'&&r.targetBase===1).length,1);
  report.cases.push({label,input,roles,firstCover:cover.playerId,firstCoverCosts:cost,
   limit:'Per-task cost table is not a proof of whole-team tactical optimality; no catch, throw, OUT or SAFE was simulated.'});
 }
 assert.notEqual(report.cases[0].firstCover,report.cases[1].firstCover,'different geometry must be able to change coverage');
 assert.equal(report.cases.find(c=>c.label==='displaced-catcher').firstCover,'C','finite positional priors must allow an emergency alternate');
 assert(report.cases.every(c=>c.firstCoverCosts.every(x=>Number.isFinite(x.total))));
 report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
assert.equal(sha(await readFile(sourcePath)),report.sourceSha256);
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,error:report.error,cases:report.cases.map(c=>({label:c.label,firstCover:c.firstCover}))}));
