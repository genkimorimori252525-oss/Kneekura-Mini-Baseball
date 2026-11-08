import {cloneInert} from '../../adjudication/OfficialWindowPolicy';

export type SwingPolicyV121=Readonly<{version:'swing_policy_v121';sourceId:string;effort:number;compactness:number;controlPriority:number;
 effortVariation:number;twoStrikeEffortDelta:number;twoStrikeCompactnessDelta:number;maximumClockAccelerationPerSecond:number}>;
export type SwingInstructionV121=Readonly<{authority:'soft'|'hard';effort:number;compactness:number;acceptance?:number}>;
const bounded=(v:number,lo:number,hi:number)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function validateSwingPolicyV121(raw:unknown):SwingPolicyV121{
 const p=cloneInert(raw) as SwingPolicyV121;
 if(!p||typeof p!=='object'||Object.keys(p).sort().join('|')!==['version','sourceId','effort','compactness','controlPriority','effortVariation','twoStrikeEffortDelta','twoStrikeCompactnessDelta','maximumClockAccelerationPerSecond'].sort().join('|')
  ||p.version!=='swing_policy_v121'||typeof p.sourceId!=='string'||!p.sourceId.trim()||p.sourceId.length>200
  ||![p.effort,p.compactness,p.controlPriority,p.effortVariation].every(n=>bounded(n,0,1))
  ||![p.twoStrikeEffortDelta,p.twoStrikeCompactnessDelta].every(n=>bounded(n,-1,1))||!bounded(p.maximumClockAccelerationPerSecond,.1,500))throw Error('invalid authored swing policy v121');
 return Object.freeze(p);
}
/** This boundary receives a player's own preference and public count only.
 * Labels select intent, never absolute speeds, success rates or public ratings. */
export function resolveBatterApproachV121(input:Readonly<{policy:SwingPolicyV121;mode:'power'|'balanced'|'contact'|'take'|'bunt';strikes:number;draw:number;instruction?:SwingInstructionV121}>){
 const p=validateSwingPolicyV121(input.policy);
 if(!Number.isInteger(input.strikes)||!bounded(input.strikes,0,2)||!bounded(input.draw,0,1))throw Error('invalid swing context');
 const count=input.strikes===2?1:0,modeShift=input.mode==='power'?.15:input.mode==='contact'?-.15:0;
 let effort=clamp(p.effort+count*p.twoStrikeEffortDelta+modeShift+(input.draw-.5)*2*p.effortVariation),
  compactness=clamp(p.compactness+count*p.twoStrikeCompactnessDelta-modeShift);
 const instruction=input.instruction;
 if(instruction){
  if(!['soft','hard'].includes(instruction.authority)||![instruction.effort,instruction.compactness,instruction.acceptance??1].every(v=>bounded(v,0,1)))throw Error('invalid swing instruction');
  const weight=instruction.authority==='hard'?1:instruction.acceptance??0;
  effort=effort*(1-weight)+instruction.effort*weight;compactness=compactness*(1-weight)+instruction.compactness*weight;
 }
 return Object.freeze({modeLabel:input.mode,effort,compactness,controlPriority:p.controlPriority,sourceId:p.sourceId,
  countAdaptation:count!==0,instructionAuthority:instruction?.authority??null,postContactResultOverride:false as const});
}
export function lateEvidenceHeadroomV121(vision:number){
 if(!bounded(vision,1,100))throw Error('invalid absolute plate vision');
 const x=Math.max(0,(vision-75)/25);return x*x*(3-2*x);
}
/** Effort limits the acceleration of the measured phase clock. It does not
 * multiply the ability ceiling or confer accuracy. Source phase is time, not
 * a claim to have measured the performer's anatomical torque. */
export function planSwingClockV121(input:Readonly<{requestedRate:number;referenceMaximumSpeedMps:number;maximumSpeedMps:number;
 maximumClockAccelerationPerSecond:number;sourceContactPhaseSeconds:number;effort:number}>){
 const {requestedRate,referenceMaximumSpeedMps,maximumSpeedMps,maximumClockAccelerationPerSecond,sourceContactPhaseSeconds,effort}=input;
 if(![requestedRate,referenceMaximumSpeedMps,maximumSpeedMps,maximumClockAccelerationPerSecond,sourceContactPhaseSeconds].every(n=>Number.isFinite(n)&&n>0)||!bounded(effort,0,1))throw Error('invalid swing motor source');
 if(effort===0)return Object.freeze({rate:0,rampSeconds:0,maximumClockAccelerationPerSecond:0,ceilingLimited:true,executable:false,calibration:'AUTHORED_PHASE_CLOCK_NOT_ANATOMICAL_TORQUE' as const});
 const acceleration=maximumClockAccelerationPerSecond*effort,
  reachableRate=Math.sqrt(2*acceleration*sourceContactPhaseSeconds),
  rate=Math.min(requestedRate,maximumSpeedMps/referenceMaximumSpeedMps,reachableRate),rampSeconds=1.5*rate/acceleration;
 return Object.freeze({rate,rampSeconds,maximumClockAccelerationPerSecond:acceleration,executable:rate>=.01&&rampSeconds<=10,
  ceilingLimited:rate<requestedRate,calibration:'AUTHORED_PHASE_CLOCK_NOT_ANATOMICAL_TORQUE' as const});
}
