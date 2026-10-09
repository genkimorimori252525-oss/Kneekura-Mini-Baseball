import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {it} from 'vitest';
import {runCompletedEndpointRecovery,type CompletedRecoveryInput} from './TerminalCompletedEndpointRecovery.test-support';
it('CR-N01 admits the actual completed tuple and closes normal retry replay without effect calls',()=>{
 const path=process.env.TERMINAL_CONTINUATION_INPUT;assert(path,'reviewed completed recovery input required');const result=runCompletedEndpointRecovery(JSON.parse(readFileSync(path,'utf8'))as CompletedRecoveryInput);assert(result.effectOwnerCalls===0&&result.completedResumeReturns===2&&result.allHandlesClosed&&result.reopened&&result.originalFailedAttemptCredit===0);
},1_700_000);
