import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {parsePracticeSwingDecisionV241} from './PracticeSwingDecisionV241';
import type {LivePitchCommandV1} from './LiveBaseballMatchV1';
import type {LiveBattingPracticeRequestV150} from './LiveBattingPracticeV150';
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error('live batting practice v150: '+message)}
const requestFields = ['batting', 'swingInstructionV121', 'battingDirectionRequestV149', 'observedSpinTrialV236', 'spinMotorPracticePolicyV239', 'practiceSwingDecisionV241', 'managerCommunicationV122', 'batterEvidenceV122', 'baserunning', 'randomnessV152'];
export function commandFor(raw:LiveBattingPracticeRequestV150, offense:0|1):LivePitchCommandV1 {
  const request = cloneInert(raw);
  assert(request && typeof request === 'object' && !Array.isArray(request) &&
    Object.keys(request).every(key => requestFields.includes(key)), 'offense-only request required');
  if(request.practiceSwingDecisionV241!==undefined){const decision=parsePracticeSwingDecisionV241(request.practiceSwingDecisionV241);
    assert(request.managerCommunicationV122===undefined&&!(decision.mode==='SWING'&&request.batting==='take'),'conflicting swing decision');}
  return { ...request, managedTeam:offense, pitchType:'auto', location:'auto' };
}

