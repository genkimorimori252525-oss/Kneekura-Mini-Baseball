import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { receivedId } from './ActualReceivedUmpireDefender';
import { actualDefensiveBoundary } from './ActualDefensiveContext';
export type RenewalEnrollmentSource = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'received_umpire_renewal_enrollment_v1'; receivedEnrollmentSourceId: string; receivedReplanSourceId: string }>;
export type RenewalDecisionSource = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'received_umpire_renewal_decision_v1'; renewalEnrollmentSourceId: string }>;
export type RenewalMotorSource = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'received_umpire_renewal_motor_v1'; renewalEnrollmentSourceId: string; renewalDecisionSourceId: string }>;
const parse = <T extends {sourceId: string; sourceVersion: string; capability: string}>(raw: T, capability: string, refs: string[], id?: string): T => {
  const source = cloneInert(raw), keys = ['sourceId','sourceVersion','capability',...refs];
  if (!source || Object.keys(source).sort().join('|') !== keys.sort().join('|') || source.capability !== capability
    || keys.filter(key => key !== 'capability').some(key => !receivedId(Reflect.get(source,key)))
    || id !== undefined && source.sourceId !== id) throw new Error('invalid received renewal Source or capability');
  return source;
};
export const renewalEnrollmentInput = (s: RenewalEnrollmentSource, id?: string) => parse(s,'received_umpire_renewal_enrollment_v1',['receivedEnrollmentSourceId','receivedReplanSourceId'],id);
export const renewalDecisionInput = (s: RenewalDecisionSource, id?: string) => parse(s,'received_umpire_renewal_decision_v1',['renewalEnrollmentSourceId'],id);
export const renewalMotorInput = (s: RenewalMotorSource, id?: string) => parse(s,'received_umpire_renewal_motor_v1',['renewalEnrollmentSourceId','renewalDecisionSourceId'],id);
export type RenewalCut = Readonly<{originTick:number;elapsedSeconds:number;tick:number;ticksPerSecond:number}>;
export const renewalExactCut = (at: Omit<RenewalCut,'ticksPerSecond'>, ticksPerSecond:number):RenewalCut => {
  const cut=cloneInert({originTick:at.originTick,elapsedSeconds:at.elapsedSeconds,tick:at.tick,ticksPerSecond});
  if(!Number.isSafeInteger(cut.tick)||cut.tick<0||cut.tick!==actualDefensiveBoundary(cut,ticksPerSecond)
    ||cut.elapsedSeconds!==(cut.tick-cut.originTick)/ticksPerSecond)throw new Error('received renewal exact integer cut differs');
  return cut;
};
export const assertRenewalCut = (left:RenewalCut,right:RenewalCut):void => {
  renewalExactCut(left,left.ticksPerSecond);renewalExactCut(right,right.ticksPerSecond);
  if(left.originTick!==right.originTick||left.elapsedSeconds!==right.elapsedSeconds||left.tick!==right.tick||left.ticksPerSecond!==right.ticksPerSecond)throw new Error('received renewal complete cut tuple differs');
};
