import {expect,it} from 'vitest';
import {createLiveFieldDecisionTraceV1} from './LiveFieldDecisionTraceV1';
it('owns bounded immutable causal entries and explicitly reports truncation',()=>{
 const trace=createLiveFieldDecisionTraceV1({enabled:true,originTick:0,ticksPerSecond:1e6,seed:7,maximumEntries:9});
 const evidence={selected:{intent:'hold'},candidates:[{cost:2}]};
 for(let i=0;i<20;i++)trace.record(i*.04,'p'+i%9,evidence,String(i));
 evidence.candidates[0].cost=99;
 const result=trace.finish()!;expect(result.entries).toHaveLength(9);expect(result.droppedEntries).toBe(11);
 expect(result.entries.every(e=>(e.evidence as {candidates:{cost:number}[]}).candidates[0].cost===2)).toBe(true);
 expect(new Set(result.entries.map(e=>(e.evidence as {playerId:string}).playerId)).size).toBe(9);
 expect(result.entries.every((e,i,a)=>!i||e.availableAtTick>=a[i-1].availableAtTick)).toBe(true);
});
it('deduplicates only a declared unchanged decision and keeps OFF allocation out of the recording path',()=>{
 const a=createLiveFieldDecisionTraceV1({enabled:true,originTick:0,ticksPerSecond:1e6,seed:7});
 a.record(0,'p',{reason:'awaiting_observation'},'same');a.record(.04,'p',{reason:'awaiting_observation'},'same');
 expect(a.finish()!.entries).toHaveLength(1);expect(a.finish()!.deduplicatedEntries).toBe(1);
 const b=createLiveFieldDecisionTraceV1({enabled:false,originTick:0,ticksPerSecond:1e6,seed:7});
 b.record(0,'p',{get secret(){throw Error('must remain unread');}});expect(b.finish()).toBeUndefined();
});
