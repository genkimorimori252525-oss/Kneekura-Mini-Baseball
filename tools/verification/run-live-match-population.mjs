import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
const [runtimeArg,outputArg,countArg='101',workersArg='16']=process.argv.slice(2);
if(!runtimeArg||!outputArg)throw new Error('requires retained runtime, NEW population output, game count, worker count');
const runtime=resolve(runtimeArg),output=resolve(outputArg),count=Number(countArg),workers=Math.min(count,Number(workersArg));
if(!Number.isSafeInteger(count)||count<1||!Number.isSafeInteger(workers)||workers<1||workers>16)throw new Error('invalid bounded population');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),manifest=JSON.parse(readFileSync(resolve(runtime,'manifest.json'),'utf8'));
if(sha(readFileSync(resolve(runtime,'live-match-audit.mjs')))!==manifest.bundleSha256)throw new Error('retained runtime hash differs');
for(const input of manifest.inputs)if(sha(readFileSync(input.path))!==input.sha256)throw new Error('current input differs from retained runtime: '+input.path);
mkdirSync(output,{recursive:false});const children=new Set(),results=[];let offset=0;
const began=Date.now();
const stop=()=>{for(const child of children)child.kill('SIGTERM');};process.once('SIGINT',stop);process.once('SIGTERM',stop);
await Promise.all(Array.from({length:workers},(_,index)=>{
 const games=Math.floor(count/workers)+(index<count%workers?1:0),firstGame=offset;offset+=games;
 const name='shard-'+String(index+1).padStart(2,'0'),directory=resolve(output,name),log=resolve(output,name+'.log'),fd=openSync(log,'wx');
 return new Promise(resolveChild=>{
  const child=spawn(process.execPath,[resolve(runtime,'live-match-audit.mjs'),String(games),directory,String(firstGame)],
   {cwd:process.cwd(),stdio:['ignore',fd,fd],windowsHide:true});children.add(child);
  child.once('error',error=>{children.delete(child);closeSync(fd);const result={name,games,firstGame,error:String(error),passed:false};results.push(result);resolveChild(result);});
  child.once('exit',(code,signal)=>{children.delete(child);closeSync(fd);let audit=null;
   if(code===0)audit=JSON.parse(readFileSync(resolve(directory,'audit.json'),'utf8'));
   const result={name,games,firstGame,code,signal,passed:code===0,audit};results.push(result);
   console.log(JSON.stringify({shard:name,passed:result.passed,games,seconds:(Date.now()-began)/1000}));resolveChild(result);
  });
 });
}));
const success=results.every(r=>r.passed),total={games:0,pitches:0,contacts:0,throws:0,catches:0,groundContacts:0,homeRuns:0,walks:0,strikeouts:0,multiOutPlays:0,runs:0,maximumInning:0,maximumPitchMs:0};
const seeds=new Set();for(const r of results)if(r.audit){for(const key of Object.keys(total)){
 if(key.startsWith('maximum'))total[key]=Math.max(total[key],r.audit[key]);else total[key]+=r.audit[key];}
 for(const summary of r.audit.summaries){if(seeds.has(summary.seed))throw new Error('duplicate population seed');seeds.add(summary.seed);}}
const report={kind:'local-core-match-population-v1',success,targetGames:count,workers,bundleSha256:manifest.bundleSha256,
 elapsedSeconds:(Date.now()-began)/1000,total,uniqueSeeds:seeds.size,shards:results.sort((a,b)=>a.firstGame-b.firstGame),nativeAuthentication:false};
writeFileSync(resolve(output,'population.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,shards:report.shards.map(({name,passed,games})=>({name,passed,games}))}));
if(!success||total.games!==count||seeds.size!==count)process.exitCode=1;
