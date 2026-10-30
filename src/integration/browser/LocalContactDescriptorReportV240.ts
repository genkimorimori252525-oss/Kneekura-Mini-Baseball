import type { LiveIssuedPitchV1 } from './LiveBaseballMatchV1';
import { contactAngleDegV240, evaluateContactAngleRuleV240 } from '../../core/world/traits/classifiers/MeasuredContactAngleRuleV240';
import type { ContactAngleRuleV240 } from '../../core/world/traits/classifiers/MeasuredContactAngleRuleV240';
type Binding=Readonly<{sessionId:string;configId:string;buildId:string;playerId:string}>;
type Rule=ContactAngleRuleV240 & Readonly<{reference:string}>;
type Entry=Readonly<{playerId:string;pitchOrdinal:number;playId:string;contactTick:number;exitVelocity:Readonly<{x:number;y:number;z:number}>;launchAngleDeg:number}>;
export type LocalContactDescriptorReportV240=Readonly<{version:'local_contact_descriptor_report_v240';scope:'LOCAL_SESSION'|'LOCAL_SAVED_DEBUG';binding:Binding;rule:Rule|null;contacts:readonly Entry[];summary:Readonly<{status:'UNASSESSED'|'ASSESSED';count:number;fraction:number|null;matched:boolean|null}>;careerConditions:'UNASSESSED';physicsEffects:'NONE';modelCalibration:'UNCONFIRMED'}>;
function summarize(contacts:readonly Entry[],rule:Rule|null):LocalContactDescriptorReportV240['summary'] {
 if(!rule||contacts.length===0)return {status:'UNASSESSED',count:0,fraction:null,matched:null};
 const result=evaluateContactAngleRuleV240(contacts.map(x=>x.launchAngleDeg),rule);
 return {status:'ASSESSED',...result};
}
export function createLocalContactDescriptorReportV240(binding:Binding,rule:Rule|null):LocalContactDescriptorReportV240 {
 if(!binding.sessionId||!binding.configId||!binding.buildId||!binding.playerId)throw new Error('missing local binding');
 if(rule!==null&&(!rule||typeof rule!=='object'||Array.isArray(rule)||Object.keys(rule).sort().join('|')!=='lowerAngleDeg|minimumFraction|reference|upperAngleDeg'||typeof rule.reference!=='string'||!rule.reference.trim()||![rule.lowerAngleDeg,rule.upperAngleDeg,rule.minimumFraction].every(Number.isFinite)||rule.lowerAngleDeg>=rule.upperAngleDeg||rule.minimumFraction<0||rule.minimumFraction>1))throw new Error('invalid explicit rule');
 const copiedRule=rule?{...rule}:null;
 return {version:'local_contact_descriptor_report_v240',scope:'LOCAL_SESSION',binding:{...binding},rule:copiedRule,contacts:[],summary:summarize([],copiedRule),careerConditions:'UNASSESSED',physicsEffects:'NONE',modelCalibration:'UNCONFIRMED'};
}
/** Caller supplies only records accepted by the live session; preview and comparison records are not acceptance. */
export function appendAcceptedContactV240(report:LocalContactDescriptorReportV240,input:Readonly<{pitch:LiveIssuedPitchV1;pitchOrdinal:number;playId:string}>):Readonly<{status:'ADDED'|'NO_CONTACT'|'DUPLICATE'|'CONFLICT';report:LocalContactDescriptorReportV240}> {
 const {pitch,pitchOrdinal,playId}=input;
 if(report.scope!=='LOCAL_SESSION'||!Number.isSafeInteger(pitchOrdinal)||pitchOrdinal<1||!playId||pitch.batterPlayerId!==report.binding.playerId)throw new Error('invalid accepted contact identity');
 const {contact,contactMoment,outgoingBallMoment}=pitch.play;
 if(!contact&&!contactMoment&&!outgoingBallMoment)return {status:'NO_CONTACT',report};
 if(!contact||!contactMoment||!outgoingBallMoment)throw new Error('incomplete accepted contact');
 const velocity=outgoingBallMoment.ball.velocity,tick=contactMoment.ball.tick;
 if(!Number.isSafeInteger(tick)||![velocity.x,velocity.y,velocity.z].every(Number.isFinite))throw new Error('invalid contact data');
 const entry:Entry={playerId:pitch.batterPlayerId,pitchOrdinal,playId,contactTick:tick,exitVelocity:{x:velocity.x,y:velocity.y,z:velocity.z},launchAngleDeg:contactAngleDegV240(velocity)};
 const old=report.contacts.find(x=>x.playerId===entry.playerId&&x.pitchOrdinal===pitchOrdinal);
 if(old){const same=old.playId===playId&&old.contactTick===tick&&(['x','y','z'] as const).every(k=>Object.is(old.exitVelocity[k],entry.exitVelocity[k]));return {status:same?'DUPLICATE':'CONFLICT',report};}
 const contacts=[...report.contacts,entry];return {status:'ADDED',report:{...report,contacts,summary:summarize(contacts,report.rule)}};
}
/** Imported data remains a self-reported debug artifact, never an authenticated session. */
export function readLocalSavedContactDescriptorReportV240(raw:unknown):LocalContactDescriptorReportV240 {
 if(!raw||typeof raw!=='object')throw new Error('invalid saved report');
 const value=raw as LocalContactDescriptorReportV240;
 if(value.version!=='local_contact_descriptor_report_v240'||(value.scope!=='LOCAL_SESSION'&&value.scope!=='LOCAL_SAVED_DEBUG')||!value.binding||!Array.isArray(value.contacts))throw new Error('invalid saved report');
 const base=createLocalContactDescriptorReportV240(value.binding,value.rule);
 const contacts:Entry[]=[];
 for(const item of value.contacts){
  if(!item||item.playerId!==base.binding.playerId||!Number.isSafeInteger(item.pitchOrdinal)||item.pitchOrdinal<1||typeof item.playId!=='string'||!item.playId||!Number.isSafeInteger(item.contactTick)||!item.exitVelocity||![item.exitVelocity.x,item.exitVelocity.y,item.exitVelocity.z].every(Number.isFinite))throw new Error('invalid saved contact');
  if(contacts.some(x=>x.playerId===item.playerId&&x.pitchOrdinal===item.pitchOrdinal))throw new Error('duplicate saved contact');
  contacts.push({playerId:item.playerId,pitchOrdinal:item.pitchOrdinal,playId:item.playId,contactTick:item.contactTick,exitVelocity:{...item.exitVelocity},launchAngleDeg:contactAngleDegV240(item.exitVelocity)});
 }
 return {...base,scope:'LOCAL_SAVED_DEBUG',contacts,summary:summarize(contacts,base.rule)};
}

/** Apply an explicit reference rule without changing contact data or authority. */
export function withLocalContactDescriptorRuleV240(report:LocalContactDescriptorReportV240,rule:Rule|null):LocalContactDescriptorReportV240 {
 const validated=createLocalContactDescriptorReportV240(report.binding,rule).rule;
 return {...report,rule:validated,summary:summarize(report.contacts,validated)};
}
