import {expect,it,vi} from 'vitest';
import * as roots from './BattedWorldFieldFixtures.test-support';
import {attachOriginalFoulEnd} from './ActualFoulPlayEndFixtures.test-support';
import {attachOriginalSettledFoulRuntime} from './ActualSettledFoulStopFixtures.test-support';
import {attachTerminalBoundary} from './TerminalContinuationBoundaryAttachment.test-support';
import {attachTerminalOfficialInputs} from './TerminalContinuationOfficialAttachment.test-support';
// Structural orchestration negatives only. No mocked owner result completes a physical or official stage.
it('registers the terminal runtime before first field work without constructing a fresh root',()=>{
 const order:string[]=[],closed=vi.fn(),root=vi.spyOn(roots,'battedWorldFieldFixture').mockImplementation(()=>{throw new Error('unexpected initial-world construction');});
 const x={f:{db:{prepare:()=>({get:()=>undefined,all:()=>[]})},close:closed},physical:{source:{sourceId:'current-bunt'}},runtimeSources:new Map(),runtimes:{accept:(id:string)=>{order.push('runtime:'+id);return{source:{sourceId:id}};}},advanceToFoul:()=>{order.push('field');throw new Error('stop at first field boundary');}};
 try{expect(()=>attachOriginalFoulEnd('/unused',x as any,'bunt',{runtimeSourceId:'new-runtime',stopSourceId:'new-stop',countSourceId:'new-count',endpointSourceId:'new-endpoint'})).toThrow('stop at first field');expect(order).toEqual(['runtime:new-runtime','field']);expect(root).not.toHaveBeenCalled();expect(closed).toHaveBeenCalledOnce();}finally{root.mockRestore();}
});
it('requires independent field Source authority before attachment performs IO',()=>{
 expect(()=>attachOriginalSettledFoulRuntime('/unused',{}as any,{fields:{}as any,response:{source:{sourceId:'accepted-response'}}as any},{source:{sourceId:'field',responseSourceId:'foreign'}as any,sources:new Map(),ids:{runtimeSourceId:'runtime',policySourceId:'policy',fieldSourceIds:[]}})).toThrow('independently accepted');
});
it('rejects shortened game policy before terminal attachment opens owners',()=>{
 const input={physicalEndSourceId:'end',sessionSourceId:'session',assignmentSourceId:'assignment',intentSourceId:'intent',recordCallSourceId:'call',advanceSourceId:'advance',fenceSourceId:'fence',terminalSourceId:'terminal',applicationId:'application',sourceVersion:'fixture-v1',assignmentSourceVersion:'fixture-v1',officialIds:['umpire-1'],officialId:'umpire-1',schedulerId:'scheduler',officialPolicy:null,legalGamePolicy:{version:'fixture-v1',minimumInnings:1,maximumInnings:1,tiesAllowed:true}};
 expect(()=>attachTerminalOfficialInputs('/unused',{}as any,input as any)).toThrow('nine-inning policy');
});

it('rejects unsupported boundary arms before queue IO',()=>{expect(()=>attachTerminalBoundary('/unused',{}as any,{}as any,{kind:'unknown'}as any)).toThrow('kind differs');});
