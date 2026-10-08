import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {runTerminalContinuationStage,type TerminalContinuationRun} from './TerminalContinuationFixture.test-support';
const selected=(stage:TerminalContinuationRun['stage'])=>{
 const path=process.env.TERMINAL_CONTINUATION_INPUT;if(!path)throw new Error('reviewed terminal continuation Native input is required');
 const input=JSON.parse(readFileSync(path,'utf8'))as TerminalContinuationRun;expect(input.stage).toBe(stage);expect(input.nativeReleased).toBe(true);
 const receipt=runTerminalContinuationStage(input,message=>console.log('[terminal-continuation] '+message));expect(receipt.stage).toBe(stage);expect(receipt.allHandlesClosed).toBe(true);
};
it('TC-N00 authenticates the retained actor checkpoint without creating a new pitch',()=>selected('admission'),3_500_000);
it('TC-N01 accepts three actual straight TAKE Sources and closes the physical K checkpoint',()=>selected('physical_k'),3_500_000);
it('TC-N02 freezes the ordinary physical closure from the preceding closed pitch checkpoint',()=>selected('closure_queued'),3_500_000);
it('TC-N03 completes separate official scoring and workload owners from the closed queue',()=>selected('closure_completed'),3_500_000);
it('TC-N04 accepts explicit away-3 and authenticates both preceding completed plays',()=>selected('next_actor'),3_500_000);
