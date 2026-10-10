import {expect,it} from 'vitest';
import {runTerminalContinuationStage} from './TerminalContinuationFixture.test-support';
// Structural admission only: these requests must fail before any artifact IO
// or Native opening. No authentic original reader is replaced or fabricated.
const run=()=>({version:'terminal_continuation_run_v1',nativeReleased:false,stage:'admission',sourceTree:'a'.repeat(40),
 recipe:{path:'/tmp/terminal-continuation-nonexistent-recipe.json',sha256:'a'.repeat(64)},predecessorReceipt:null,
 destinationPath:'/tmp/terminal-continuation-not-created.sqlite',receiptPath:'/tmp/terminal-continuation-not-created.json'}as const);
it('TC-D01 never starts a Native stage without the explicit reviewed release',()=>{
 expect(()=>runTerminalContinuationStage(run())).toThrow(/reviewed and released/);
});
it('TC-D02 captures run controls inertly before reading release or source properties',()=>{
 const input={...run()};let invoked=0;Object.defineProperty(input,'nativeReleased',{enumerable:true,get(){invoked++;return true;}});
 expect(()=>runTerminalContinuationStage(input)).toThrow();expect(invoked).toBe(0);
});
it('TC-D03 rejects caller Match and unknown run fields before opening recipe files',()=>{
 const input={...run(),nativeReleased:true,match:{outs:2}};
 expect(()=>runTerminalContinuationStage(input),'CONTINUATION_RUN_FIELDS_NOT_STRICT').toThrow(/run fields/);
});
