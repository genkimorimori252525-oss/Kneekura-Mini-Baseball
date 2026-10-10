import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {receivedId} from './ActualReceivedUmpireDefender';
import {ownedScheduledMotionActionInput} from './OwnedScheduledBattedWorldMotion';
import {actualCommunicationInput,type AcceptedActualCallCommunication} from './ActualCallCommunication';
import type {AcceptedBattedWorldFieldExecution} from './SqliteBattedWorldFieldExecutionStore';
export type ReceivedHandoffSource=Readonly<{sourceId:string;sourceVersion:string;capability:'received_umpire_physical_communication_handoff_v1';
  renewalEnrollmentSourceId:string;predecessorExecutionSourceId:string;executionSourceId:string;communicationSourceId:string}>;
export const receivedHandoffInput=(raw:ReceivedHandoffSource,id?:string):ReceivedHandoffSource=>{
  const s=cloneInert(raw),keys=['sourceId','sourceVersion','capability','renewalEnrollmentSourceId','predecessorExecutionSourceId','executionSourceId','communicationSourceId'];
  if(!s||Object.keys(s).sort().join('|')!==keys.sort().join('|')||s.capability!=='received_umpire_physical_communication_handoff_v1'
    ||keys.filter(k=>k!=='capability').some(k=>!receivedId(Reflect.get(s,k)))||id!==undefined&&s.sourceId!==id||s.predecessorExecutionSourceId===s.executionSourceId)throw new Error('invalid received handoff Source');
  return s;
};
/** This handoff admits only the existing retained quantizer seal and its normal
 * communication revision. No caller command/model or new owner enum is added. */
export const receivedHandoffSuccessorInputs=(source:ReceivedHandoffSource,rawExecution:AcceptedBattedWorldFieldExecution,rawCommunication:AcceptedActualCallCommunication)=>{
  const s=receivedHandoffInput(source),x=cloneInert(rawExecution),c=actualCommunicationInput(rawCommunication,s.communicationSourceId);
  if(!x||Object.keys(x).sort().join('|')!=='action|baseFieldSourceId|previousExecutionSourceId|sourceId|sourceVersion'
    ||![x.sourceId,x.sourceVersion,x.baseFieldSourceId,x.previousExecutionSourceId].every(receivedId)
    ||x.sourceId!==s.executionSourceId||x.previousExecutionSourceId!==s.predecessorExecutionSourceId||x.action.kind!=='owned_motion_v2')throw new Error('received handoff physical successor differs');
  const action=ownedScheduledMotionActionInput(x.action);
  if(action.kind!=='owned_motion_v2'||action.checkpoint.kind!=='retained_quantizer_bucket_v1'||action.contributions.some(p=>p.kind!=='retained')
    ||c.currentExecutionSourceId!==x.sourceId||c.previousCommunicationSourceId===null)throw new Error('received handoff requires retained quantizer motion and a normal communication revision');
  return {execution:{...x,action},communication:c};
};
