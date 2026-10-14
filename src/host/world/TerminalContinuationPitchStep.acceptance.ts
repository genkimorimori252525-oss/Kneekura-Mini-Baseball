import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {runTerminalContinuationPitchStep,type TerminalPitchStepInput} from './TerminalContinuationPitchStep.test-support';
const run=(step:TerminalPitchStepInput['step'])=>{const path=process.env.TERMINAL_CONTINUATION_PITCH_STEP_INPUT;if(!path)throw new Error('reviewed single-pitch input required');const input=JSON.parse(readFileSync(path,'utf8'))as TerminalPitchStepInput;expect(input.step).toBe(step);const result=runTerminalContinuationPitchStep(input);expect(result.step).toBe(step);expect(result.allHandlesClosed).toBe(true);expect(result.aggregateP1Credit).toBe(0);};
it('PS-N01 admits exact TAKE-1 from the qualified one-pitch input and closes actual count 0-2',()=>run('take_1'),3_500_000);
it('PS-N02 admits exact TAKE-2 from the qualified two-pitch input and closes the actual physical K',()=>run('take_2'),3_500_000);
