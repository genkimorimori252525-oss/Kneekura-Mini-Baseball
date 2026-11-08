import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('tools/browser-bridge/background-match-v116.js','utf8'),command={batting:'take'},other={batting:'balanced'};
function fixture(){
 const scope=vm.createContext({structuredClone}),workers=[];vm.runInContext(source,scope);
 const host=scope.KneekuraBackgroundMatchV116.create({configuration:{seed:1},initialHost:{inspect:()=>({pitchCount:0,finished:false,history:[],score:0})},
  coreSource:'/* test */',lookAhead:4,warmup:2,workerFactory:()=>{const w={messages:[],terminated:false,postMessage(m){this.messages.push(m);},terminate(){this.terminated=true;}};workers.push(w);return w;}});
 const emit=(w,n,finished=false)=>w.onmessage({data:{kind:'record',epoch:w.messages[0].epoch,
  record:{finished,frames:[{tick:n}],secretFutureResult:n,command},snapshot:{pitchCount:n,finished,score:n},continuation:{pitchCount:n}}});
 return{host,workers,emit};
}
test('future results stay private until consumed and startup warms a result-independent fixed count',async()=>{
 const {host,workers,emit}=fixture();host.prefetch(command);const w=workers[0];
 const initial=host.inspect();emit(w,1);assert.equal(host.inspect(),initial);assert.equal(host.inspect().pitchCount,0);assert.equal(host.inspect().history.length,0);
 const next=host.issuePitch(command);let resolved=false;next.then(()=>resolved=true);await Promise.resolve();assert(!resolved);
 emit(w,2);const r=await next;assert.equal(r.secretFutureResult,1);assert(Object.isFrozen(r.frames));assert.equal(host.inspect().pitchCount,1);
 assert.equal(host.inspect().history.length,1);assert.equal(host.generationV116().queued,1);
 assert.equal((await host.issuePitch(command)).secretFutureResult,2);host.dispose();
});
test('command changes discard unseen results and restart from the last accepted continuation',async()=>{
 const {host,workers,emit}=fixture(),first=host.issuePitch(command),w=workers[0];emit(w,1);emit(w,2);await first;
 host.invalidate();assert(w.terminated);const second=host.issuePitch(other),v=workers[1];
 assert.equal(v.messages[0].continuation.pitchCount,1);assert.equal(v.messages[0].command.batting,'balanced');
 emit(w,999);assert.equal(host.inspect().pitchCount,1);emit(v,2);emit(v,3);
 assert.equal((await second).secretFutureResult,2);assert.equal(host.inspect().history.length,2);assert.equal(host.generationV116().discarded,1);host.dispose();
});
test('new game or dispose aborts pending work and late messages never publish',async()=>{
 const {host,workers,emit}=fixture(),request=host.issuePitch(command),caught=request.catch(e=>e),w=workers[0];host.dispose();
 assert.equal((await caught).name,'AbortError');emit(w,999);assert.equal(host.inspect().pitchCount,0);assert(w.terminated);
});
test('game end can flush fewer warmup records without inventing pitches',async()=>{
 const {host,workers,emit}=fixture(),p=host.issuePitch(command);emit(workers[0],1,true);
 assert.equal((await p).finished,true);assert.equal(await host.issuePitch(command),null);assert.equal(host.inspect().history.length,1);host.dispose();
});
test('background failure rejects pending work without changing the public frontier',async()=>{
 const {host,workers}=fixture(),p=host.issuePitch(command),caught=p.catch(e=>e),w=workers[0];
 w.onmessage({data:{kind:'error',epoch:w.messages[0].epoch,error:{name:'Error',message:'test diagnostic'}}});
 assert.equal((await caught).message,'test diagnostic');assert.equal(host.inspect().pitchCount,0);assert(w.terminated);host.dispose();
});
test('a future error is revealed only after every earlier valid record is consumed',async()=>{
 const {host,workers,emit}=fixture();host.prefetch(command);const w=workers[0];emit(w,1);emit(w,2);emit(w,3);
 w.onmessage({data:{kind:'error',epoch:w.messages[0].epoch,error:{name:'Error',message:'future fourth pitch'}}});
 for(let n=1;n<=3;n++){assert.equal((await host.issuePitch(command)).secretFutureResult,n);assert.equal(host.inspect().pitchCount,n);}
 await assert.rejects(host.issuePitch(command),/future fourth pitch/);assert.equal(host.inspect().history.length,3);host.dispose();
});
test('a pitcher-change boundary flushes warmup and starts a new worker with the newly selected command',async()=>{
 const {host,workers}=fixture(),p=host.issuePitch(command),w=workers[0];
 w.onmessage({data:{kind:'record',epoch:w.messages[0].epoch,boundary:true,record:{finished:false,frames:[]},
  snapshot:{pitchCount:1,finished:false},continuation:{pitchCount:1}}});
 await p;assert(w.terminated);host.prefetch(other);assert.equal(workers.length,2);
 assert.equal(workers[1].messages[0].command.batting,'balanced');assert.equal(workers[1].messages[0].continuation.pitchCount,1);host.dispose();
});
test('a redundant UI change event leaves the matching speculative queue intact',async()=>{
 const {host,workers,emit}=fixture();host.prefetch(command);emit(workers[0],1);emit(workers[0],2);host.invalidate(command);
 assert(!workers[0].terminated);assert.equal((await host.issuePitch(command)).secretFutureResult,1);host.dispose();
});
