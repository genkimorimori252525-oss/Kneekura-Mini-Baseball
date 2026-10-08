import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
const moduleId='./TerminalContinuationPitchStep.test-support';
const api=async()=>{const m=existsSync(new URL('./TerminalContinuationPitchStep.test-support.ts',import.meta.url))?await import(/* @vite-ignore */moduleId):{};expect(typeof m.capturePitchStepInput,'PITCH_STEP_API_MISSING').toBe('function');return m as any;};
const pin={path:'/private/qualified.json',sha256:'a'.repeat(64)};
const input=()=>({version:'terminal_continuation_pitch_step_v1',nativeReleased:false,step:'take_1',sourceTree:'a'.repeat(40),predecessor:pin,recipe:pin,destinationDirectory:'/private/new',tracePath:'/private/new/trace.jsonl',receiptPath:'/private/new/receipt.json'});
// Structural controls/guards only; no original Native reader is fabricated.
it('PS-S01 captures only the exact inert single-pitch controls',async()=>{
 const m=await api();expect(m.capturePitchStepInput(input())).toEqual(input());expect(()=>m.capturePitchStepInput({...input(),outs:2})).toThrow();expect(()=>m.capturePitchStepInput({...input(),step:'take_0'})).toThrow();let calls=0;const value=input();Object.defineProperty(value,'step',{enumerable:true,get(){calls++;return'take_1';}});expect(()=>m.capturePitchStepInput(value)).toThrow();expect(calls).toBe(0);
});
it('PS-S02 refuses an unreleased pitch step before artifact access',async()=>{
 const m=await api();expect(()=>m.runTerminalContinuationPitchStep(input())).toThrow(/reviewed and released/);
});
it('PS-S03 requires the exact qualified closed predecessor and never skips from TAKE-0 to TAKE-2',async()=>{
 const m=await api(),prior={version:'terminal_retained_one_pitch_qualified_input_v1',qualified:true,allHandlesClosed:true,reopened:true,originalRowsPreserved:true,aggregateP1Credit:0,artifact:pin,physical:{sourceId:'terminal-continuation-k-take-0',progressRevision:1,count:{balls:0,strikes:1}}};
 expect(m.validatePitchStepPredecessor('take_1',prior)).toEqual(prior);expect(()=>m.validatePitchStepPredecessor('take_2',prior)).toThrow();for(const change of [{qualified:false},{allHandlesClosed:false},{aggregateP1Credit:1},{physical:{...prior.physical,sourceId:'foreign'}}])expect(()=>m.validatePitchStepPredecessor('take_1',{...prior,...change})).toThrow();
 const next={...prior,version:'terminal_continuation_pitch_step_qualified_input_v1',step:'take_1',physical:{sourceId:'terminal-continuation-k-take-1',progressRevision:2,count:{balls:0,strikes:2}}};expect(m.validatePitchStepPredecessor('take_2',next)).toEqual(next);
});
it('PS-S04 conserves original rows while adding one exact pitch and advancing only its existing head',async()=>{
 const m=await api(),before:any[]=[{table:'matches',rows:[{__ack_rowid:1,state_json:'original'}]},{table:'physical_pitch_progress_actions',rows:[{__ack_rowid:1,source_id:'terminal-continuation-k-take-0'}]},{table:'physical_pitch_progress_heads',rows:[{__ack_rowid:1,game_id:'game-1',play_id:8,revision:1,last_source_id:'terminal-continuation-k-take-0'}]}];
 const after=structuredClone(before);after[1].rows.push({__ack_rowid:2,game_id:'game-1',play_id:8,source_id:'terminal-continuation-k-take-1',progress_revision:2});Object.assign(after[2].rows[0],{revision:2,last_source_id:'terminal-continuation-k-take-1'});expect(()=>m.assertPitchStepRows(before,after,'take_1')).not.toThrow();after[0].rows[0].state_json='changed';expect(()=>m.assertPitchStepRows(before,after,'take_1')).toThrow();expect(()=>m.assertPitchStepRows(before,before,'take_1')).toThrow();
});
it('PS-S05 requires actual two strikes after TAKE-1 and actual K after TAKE-2',async()=>{
 const m=await api();const prefix=(kind:string)=>[0,1,2].map(i=>({source:{sourceId:'terminal-continuation-k-take-'+i},progressRevision:i+1,result:{pitch:{resolution:{timeline:{playId:8,status:i<2?{kind:'active',count:{balls:0,strikes:i+1}}:{kind}}}}}}));
 expect(()=>m.assertPitchStepResult(prefix('strikeout').slice(0,2),'take_1')).not.toThrow();expect(()=>m.assertPitchStepResult(prefix('strikeout'),'take_2')).not.toThrow();expect(()=>m.assertPitchStepResult(prefix('walk'),'take_2')).toThrow();const wrong=prefix('strikeout').slice(0,2);wrong[1].result.pitch.resolution.timeline.status={kind:'active',count:{balls:1,strikes:1}};expect(()=>m.assertPitchStepResult(wrong,'take_1')).toThrow();
});
it('PS-S06 fsyncs returned-write observations before later replay or closure can fail',async()=>{
 const m=await api(),directory=mkdtempSync(join(tmpdir(),'pitch-step-trace-')),path=join(directory,'trace.jsonl'),trace=m.createPitchStepTrace(path);const pitch={source:{sourceId:'terminal-continuation-k-take-1'},progressRevision:2,result:{pitch:{resolution:{timeline:{status:{kind:'active',count:{balls:0,strikes:2}}}}}}};
 try{trace.returned('accept',pitch);const saved=JSON.parse(readFileSync(path,'utf8').trim());expect(saved.event).toBe('owner_returned');expect(saved.sourceId).toBe(pitch.source.sourceId);expect(saved.progressRevision).toBe(2);expect(()=>trace.span('readback',()=>{throw new Error('later replay failed');})).toThrow(/later replay/);const rows=readFileSync(path,'utf8').trim().split('\n').map(line=>JSON.parse(line));expect(rows.map((r:any)=>r.event)).toEqual(['owner_returned','start','failed']);expect(rows[2]).not.toHaveProperty('elapsedMs');}finally{trace.close();rmSync(directory,{recursive:true,force:true});}
});
