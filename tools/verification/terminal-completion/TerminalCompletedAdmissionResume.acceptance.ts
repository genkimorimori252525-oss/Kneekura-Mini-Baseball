import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {it} from 'vitest';
import {runCompletedAdmissionResume,type CompletedAdmissionResumeInput} from './TerminalCompletedEndpointRecovery.test-support';
it('CA-N01 resumes the closed actual admission twice without repeating admission or effects',()=>{const path=process.env.TERMINAL_CONTINUATION_INPUT;assert(path,'reviewed admission resume input required');const r=runCompletedAdmissionResume(JSON.parse(readFileSync(path,'utf8'))as CompletedAdmissionResumeInput);assert(r.completedResumeReturns===2&&r.effectOwnerCalls===0&&r.interruptedRecoveryCredit===0&&r.originalFailedAttemptCredit===0&&r.allHandlesClosed&&r.reopened);},1_700_000);
