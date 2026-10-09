import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
const moduleId='./TerminalRetainedPrefixRecovery.test-support';
const api=async()=>{const m=existsSync(new URL('./TerminalRetainedPrefixRecovery.test-support.ts',import.meta.url))?await import(/* @vite-ignore */moduleId):{};
 expect(typeof m.captureRetainedRecoveryInput,'RETAINED_RECOVERY_API_MISSING').toBe('function');return m as any;};
const pin={path:'/private/pin.json',sha256:'a'.repeat(64)};
const input=()=>({version:'terminal_retained_prefix_recovery_v1',nativeReleased:false,sourceTree:'a'.repeat(40),failed:{config:pin,input:pin,terminal:pin,tuple:pin},admission:{config:pin,terminal:pin,report:pin,receipt:pin},recipe:pin,destinationDirectory:'/private/new',tracePath:'/private/new/trace.jsonl',receiptPath:'/private/new/receipt.json'});
// Structural controls and raw-row conservation only. These fixtures never
// substitute for a successful original Native evidence reader.
it('TR-S01 captures exact recovery controls and refuses caller outcomes or accessor evaluation',async()=>{
 const m=await api();expect(m.captureRetainedRecoveryInput(input())).toEqual(input());expect(()=>m.captureRetainedRecoveryInput({...input(),desiredCount:{strikes:1}})).toThrow();
 const value=input();let invoked=0;Object.defineProperty(value,'nativeReleased',{enumerable:true,get(){invoked++;return true;}});expect(()=>m.captureRetainedRecoveryInput(value)).toThrow();expect(invoked).toBe(0);
});
it('TR-S02 rejects an unreleased recovery before recipe or artifact access',async()=>{
 const m=await api();expect(()=>m.recoverRetainedTerminalPrefix(input())).toThrow(/reviewed and released/);
});
it('TR-S03 requires a complete nonempty main WAL SHM tuple with an absent rollback journal',async()=>{
 const m=await api(),rows=['','-wal','-shm','-journal'].map((suffix,i)=>({path:'/private/game.sqlite'+suffix,exists:i<3,...(i<3?{sha256:'a'.repeat(64),stat:{dev:1,ino:i+1,size:4096,mtimeNs:1,ctimeNs:1}}:{})}));
 expect(m.validateRetainedRecoveryTuple(rows)).toHaveLength(4);
 for(const changed of [rows.slice(0,1),rows.map((r,i)=>i===1?{...r,exists:false}:r),rows.map((r,i)=>i===1?{...r,stat:{...r.stat,size:0}}:r),rows.map((r,i)=>i===3?{...r,exists:true}:r),rows.map((r,i)=>i===2?{...r,path:'/other/game.sqlite-shm'}:r)])expect(()=>m.validateRetainedRecoveryTuple(changed)).toThrow();
});
it('TR-S04 permits exactly one retained TAKE and head while conserving every original row',async()=>{
 const m=await api(),before:any[]=[{table:'matches',rows:[{__ack_rowid:1,match_id:'game-1',state_json:'old'}]},{table:'physical_pitch_progress_actions',rows:[]},{table:'physical_pitch_progress_heads',rows:[]}];
 const after=structuredClone(before);after[1].rows.push({__ack_rowid:1,source_id:'terminal-continuation-k-take-0',game_id:'game-1',play_id:8,progress_revision:1});after[2].rows.push({__ack_rowid:1,game_id:'game-1',play_id:8,revision:1,last_source_id:'terminal-continuation-k-take-0'});
 expect(()=>m.assertRetainedTakeOnly(before,after)).not.toThrow();const second=structuredClone(after);second[1].rows.push({...second[1].rows[0],__ack_rowid:2,source_id:'terminal-continuation-k-take-1',progress_revision:2});expect(()=>m.assertRetainedTakeOnly(before,second)).toThrow();
 after[0].rows[0].state_json='changed';expect(()=>m.assertRetainedTakeOnly(before,after)).toThrow();expect(()=>m.assertRetainedTakeOnly(before,before)).toThrow();
});
it('TR-S05 synchronously persists span starts and only completed timing before returning a result',async()=>{
 const m=await api(),directory=mkdtempSync(join(tmpdir(),'retained-trace-')),path=join(directory,'trace.jsonl');let time=10;const trace=m.createRetainedRecoveryTrace(path,()=>time);
 try{const result=trace.span('readiness',()=>{expect(JSON.parse(readFileSync(path,'utf8').trim()).event).toBe('start');time=25;return 9;});expect(result).toBe(9);
 const rows=readFileSync(path,'utf8').trim().split('\n').map(line=>JSON.parse(line));expect(rows.map((r:any)=>r.event)).toEqual(['start','complete']);expect(rows[1].elapsedMs).toBe(15);expect(trace.close().events).toBe(2);expect(()=>trace.span('readiness',()=>0)).toThrow();}finally{trace.close();rmSync(directory,{recursive:true,force:true});}
});
it('TR-S06 records a failed span without promoting it to completed timing or swallowing the owner error',async()=>{
 const m=await api(),directory=mkdtempSync(join(tmpdir(),'retained-trace-')),path=join(directory,'trace.jsonl'),trace=m.createRetainedRecoveryTrace(path);const failure=new Error('owner rejected');
 try{expect(()=>trace.span('retained_pitch',()=>{throw failure;})).toThrow(failure);const rows=readFileSync(path,'utf8').trim().split('\n').map(line=>JSON.parse(line));expect(rows.map((r:any)=>r.event)).toEqual(['start','failed']);expect(rows[1]).not.toHaveProperty('elapsedMs');}finally{trace.close();rmSync(directory,{recursive:true,force:true});}
});
