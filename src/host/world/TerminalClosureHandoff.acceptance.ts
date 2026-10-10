import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {runTerminalClosureHandoff,type TerminalClosureHandoffInput} from './TerminalClosureHandoff.test-support';
it('HC-N01 queues and closes the ordinary closure from the actual qualified split-pitch K',()=>{const path=process.env.TERMINAL_CLOSURE_HANDOFF_INPUT;if(!path)throw new Error('reviewed closure handoff input required');const result=runTerminalClosureHandoff(JSON.parse(readFileSync(path,'utf8'))as TerminalClosureHandoffInput);expect(result.version).toBe('terminal_continuation_stage_v2');expect(result.stage).toBe('closure_queued');expect(result.allHandlesClosed).toBe(true);},1_700_000);
