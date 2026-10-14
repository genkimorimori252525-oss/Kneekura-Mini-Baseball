import {expect,it} from 'vitest';
import {receivedHandoffInput,receivedHandoffSuccessorInputs} from './ActualReceivedUmpireHandoff';
const source={sourceId:'handoff-a',sourceVersion:'test-v1',capability:'received_umpire_physical_communication_handoff_v1' as const,
  renewalEnrollmentSourceId:'renewal-a',predecessorExecutionSourceId:'adoption-a',executionSourceId:'seal-a',communicationSourceId:'communication-2'};
it('RHF01 requires distinct exact predecessor and successor references without caller physics',()=>{
  expect(receivedHandoffInput(source)).toEqual(source);
  expect(()=>receivedHandoffInput({...source,executionSourceId:source.predecessorExecutionSourceId})).toThrow();
  expect(()=>receivedHandoffInput({...source,tick:3} as never)).toThrow();
});
it('RHF02 rejects ordinary motion or a communication bound to a different physical head',()=>{
  const communication={sourceId:'communication-2',sourceVersion:'test-v1',callSourceId:'call-a',modelSourceId:'model-a',currentExecutionSourceId:'foreign',previousCommunicationSourceId:'communication-1'};
  expect(()=>receivedHandoffSuccessorInputs(source,{sourceId:'seal-a',sourceVersion:'v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'adoption-a',action:{kind:'retained_motion_checkpoint_v1',checkpointThroughTick:3}},communication)).toThrow(/successor/);
});
it('RHF03 retains a received adoption reference only through the explicit v2 parser and final-head communication',async()=>{
  const {ownedMotionActionInput}=await import('./OwnedBattedWorldMotion');
  const ids=Array.from({length:10},(_,i)=>'p'+i),at={originTick:0,elapsedSeconds:0.1,tick:100};
  const contributions=ids.map((playerId,i)=>({kind:'retained' as const,playerId,command:{kind:i===0?'received_renewal_adoption_v1' as const:'field' as const,
    owner:'batted_world_field_executions' as const,sourceId:'original-'+i,sourceVersion:'v1',sourceHash:'source-hash-'+i,adoptionSourceId:'adoption-'+i,
    adoptionSourceHash:'adoption-hash-'+i,adoptedAt:at,executedThrough:at,acceptedThroughTick:1000}}));
  const knownWork=ids.map(playerId=>({playerId,decisionSourceId:null,motorSourceId:null}));
  const execution={sourceId:'seal-a',sourceVersion:'v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'adoption-a',
    action:{kind:'owned_motion_v2' as const,checkpoint:{kind:'retained_quantizer_bucket_v1' as const,throughTick:100},contributions,knownWork}};
  const communication={sourceId:'communication-2',sourceVersion:'v1',callSourceId:'call-a',modelSourceId:'model-a',currentExecutionSourceId:'seal-a',previousCommunicationSourceId:'communication-1'};
  expect(receivedHandoffSuccessorInputs(source,execution,communication)).toEqual({execution,communication});
  expect(()=>receivedHandoffSuccessorInputs(source,execution,{...communication,currentExecutionSourceId:'foreign'})).toThrow(/normal communication/);
  expect(()=>ownedMotionActionInput({kind:'owned_motion_v1',checkpointThroughTick:100,contributions,knownWork})).toThrow(/retained motion/);
});
