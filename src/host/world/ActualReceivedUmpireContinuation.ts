import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { receivedId } from './ActualReceivedUmpireDefender';
import { renewalExactCut,type RenewalCut } from './ActualReceivedUmpireRenewal';
export type ReceivedContinuationSource=Readonly<{sourceId:string;sourceVersion:string;baseFieldSourceId:string;previousExecutionSourceId:string;
  action:Readonly<{kind:'received_renewal_continuation_v1';renewalEnrollmentSourceId:string;renewalAdoptionSourceId:string}>}>;
export const receivedContinuationInput=(raw:ReceivedContinuationSource,id?:string):ReceivedContinuationSource=>{
  const s=cloneInert(raw);
  if(!s||Object.keys(s).sort().join('|')!=='action|baseFieldSourceId|previousExecutionSourceId|sourceId|sourceVersion'
    ||![s.sourceId,s.sourceVersion,s.baseFieldSourceId,s.previousExecutionSourceId].every(receivedId)||s.sourceId===s.previousExecutionSourceId
    ||id!==undefined&&s.sourceId!==id||!s.action||Object.keys(s.action).sort().join('|')!=='kind|renewalAdoptionSourceId|renewalEnrollmentSourceId'
    ||s.action.kind!=='received_renewal_continuation_v1'||!receivedId(s.action.renewalEnrollmentSourceId)
    ||s.action.renewalAdoptionSourceId!==s.previousExecutionSourceId)throw new Error('invalid received positive continuation Source');
  return s;
};
/** Initial adoption is an exact locomotion cut. The result may be an earlier
 * fractional Core boundary and must never be rounded back onto this lattice. */
export const receivedContinuationBound=(at:RenewalCut,coverageThroughTick:number,dueTicks:readonly (number|null)[])=>{
  renewalExactCut(at,at.ticksPerSecond);
  if(!Number.isSafeInteger(coverageThroughTick)||coverageThroughTick<=at.tick||dueTicks.some(t=>t!==null&&(!Number.isSafeInteger(t)||t<=at.tick)))throw new Error('received continuation due work or coverage blocks progress');
  return Math.min(coverageThroughTick,...dueTicks.flatMap(t=>t===null?[]:[t]));
};
