// Read-only analysis of the preserved Worker CPU-profile evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
assert.equal(process.versions.node.split('.')[0],'24');
const out=resolve(process.argv[2]);assert(out.startsWith(resolve('docs/verification/releases/v113/latency-')));
const raw=readFileSync(resolve(out,'cpu-profile.cpuprofile'),'utf8');let invalidJsonBackslashRepairs=0;
// Node 24's Worker profiler emits RegExp function names with literal \d/\s.
// Preserve the raw receipt and repair only illegal JSON escapes in a derivative.
const valid=raw.replace(/\\(?!["\\/bfnrtu])/g,()=>{invalidJsonBackslashRepairs++;return '\\\\';});
let profile;try{profile=JSON.parse(valid);}catch(error){throw Error('Cannot parse preserved profile: '+String(error));}
writeFileSync(resolve(out,'cpu-profile.valid-json.cpuprofile'),valid);
const byId=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();
for(const node of profile.nodes)for(const child of node.children??[])parents.set(child,node.id);
const self=new Map(),inclusive=new Map();
for(let i=0;i<profile.samples.length;i++){
 const dt=profile.timeDeltas?.[i]??1;let id=profile.samples[i];self.set(id,(self.get(id)??0)+dt);
 while(id){inclusive.set(id,(inclusive.get(id)??0)+dt);id=parents.get(id);}
}
const aggregate=map=>{
 const grouped=new Map();for(const [id,us]of map){const frame=byId.get(id).callFrame,
  key=JSON.stringify([frame.functionName,frame.lineNumber,frame.url]),row=grouped.get(key)??{function:frame.functionName,line:frame.lineNumber+1,ms:0};
  row.ms+=us/1000;grouped.set(key,row);}
 return [...grouped.values()].sort((a,b)=>b.ms-a.ms).slice(0,30);
};
const groups={},slow=readFileSync(resolve(out,'slow-calls.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
for(const row of slow){const group=groups[row.name]??={count:0,totalMs:0,maxMs:0};group.count++;group.totalMs+=row.ms;group.maxMs=Math.max(group.maxMs,row.ms);}
const summary=JSON.parse(readFileSync(resolve(out,'summary.json'))),result={kind:summary.kind,time:summary.time,plans:summary.plans,
 callCounts:summary.callCounts,invalidJsonBackslashRepairs,self:aggregate(self),inclusive:aggregate(inclusive),slow:groups,
 notes:['Inclusive nested times overlap; do not sum parent and child times.',
  'Slow-call receipt records only completed >=50ms calls after sim9.35s.',
  'Instrumentation/profiling overhead is included; no physical input or product Source changed.']};
writeFileSync(resolve(out,'profile-summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({out,kind:result.kind,time:result.time,callCounts:result.callCounts,
 inclusive:result.inclusive.filter(r=>['plan','evaluateCandidate','evaluateTiming','planLiveRelayV1','planLiveThrowV1','estimateLiveDefenseControlV95'].includes(r.function)).slice(0,12)}));
