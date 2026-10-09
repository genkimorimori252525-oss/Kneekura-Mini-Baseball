import {expect,it} from 'vitest';
import {receivedRecipientConsumed,type ReceivedControllerExtension} from './ActualReceivedUmpireTerminalCoverage';
import type {DurableActualCallCommunication} from './ActualCallCommunication';
const at={originTick:100,elapsedSeconds:0.5,tick:600};
const recipient={playerId:'defender',personId:'person-a',receivedEnrollmentSourceId:'e',renewalEnrollmentSourceId:'renewal',callSourceId:'call-a',originCommunicationSourceId:'origin-a',
  observationSourceId:'observation-a',incumbentDecisionSourceId:'old-decision',renewalDecisionSourceId:'new-decision',renewalMotorSourceId:'new-motor',adoptionSourceId:'adoption-a',handoffSourceId:'handoff-a',consumedAt:at};
const proof:ReceivedControllerExtension={version:'received_controller_terminal_coverage_v1',runtimeSourceId:'runtime',claimsDigest:'digest',allTransferred:true,physicalReferences:[],communicationReferences:[],recipients:[recipient]};
const communication={source:{callSourceId:'call-a'},originCommunicationSourceId:'origin-a',recipients:[{playerId:'defender',kind:'received',reception:{receivedAtElapsedSeconds:0.49}}]} as unknown as DurableActualCallCommunication;
it('RCT01 consumes only the exact independently owned receiver call and origin communication',()=>{
  expect(receivedRecipientConsumed(proof,communication,'defender',at)).toBe(true);
  expect(receivedRecipientConsumed(proof,communication,'other-defender',at)).toBe(false);
  expect(receivedRecipientConsumed(proof,{...communication,originCommunicationSourceId:'origin-b'},'defender',at)).toBe(false);
  expect(receivedRecipientConsumed(proof,{...communication,source:{...communication.source,callSourceId:'call-b'}},'defender',at)).toBe(false);
});
it('RCT02 reception or elapsed time alone never substitutes for controller handoff',()=>{
  expect(receivedRecipientConsumed(null,communication,'defender',at)).toBe(false);
  expect(receivedRecipientConsumed({...proof,recipients:[{...recipient,handoffSourceId:null}]},communication,'defender',{...at,elapsedSeconds:9,tick:9100})).toBe(false);
  expect(receivedRecipientConsumed({...proof,recipients:[{...recipient,consumedAt:{...at,elapsedSeconds:0.50001}}]},communication,'defender',at)).toBe(false);
});
it('RCT03 scheduled same-tick delivery and duplicate receiver claims remain pending',()=>{
  const scheduled={...communication,recipients:[{...communication.recipients[0],kind:'scheduled',reception:{...communication.recipients[0].kind==='received'?communication.recipients[0].reception:{},receivedAtElapsedSeconds:0.50001}}]} as unknown as DurableActualCallCommunication;
  expect(receivedRecipientConsumed(proof,scheduled,'defender',at)).toBe(false);
  expect(receivedRecipientConsumed({...proof,recipients:[recipient,recipient]},communication,'defender',at)).toBe(false);
});
