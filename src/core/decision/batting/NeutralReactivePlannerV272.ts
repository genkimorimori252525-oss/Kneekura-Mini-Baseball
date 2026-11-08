import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import {enumerateObservedReactiveYawV255,type ObservedReactiveRegistrationInputV161} from '../../sim/contact/ObservedDirectionRegistrationV153';
import {selectNeutralReactiveDirectionV271} from './NeutralReactiveDirectionSelectorV271';

/** Explicit nominal planner only. Caller selects this branch and supplies one shared uint32. */
export function planNeutralReactiveDirectionV272(raw:Readonly<{registration:ObservedReactiveRegistrationInputV161;bats:'R'|'L';drawUint32:number}>) {
 const input=cloneInert(raw);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!=='bats|drawUint32|registration')throw Error('invalid neutral reactive planner input');
 // Validate handedness/draw before invoking the existing, potentially expensive enumerator.
 selectNeutralReactiveDirectionV271({bats:input.bats,drawUint32:input.drawUint32,candidates:[]});
 const entries=enumerateObservedReactiveYawV255(input.registration);
 const projected=entries.map(({reference,candidate,preparationTransferCostMps})=>{
  if(candidate.status==='PREDICTED_CONTACT'){
   if(reference===null||candidate.predictedContact===null||preparationTransferCostMps===null)throw Error('inconsistent predicted registration');
  }else if(reference!==null||candidate.predictedContact!==null||preparationTransferCostMps!==null)throw Error('inconsistent unresolved registration');
  return {yawDegrees:candidate.yawDegrees,status:candidate.status,fieldAngleDegrees:candidate.predictedContact?.fieldAngleDegrees??null,preparationTransferCostMps};
 });
 const selection=selectNeutralReactiveDirectionV271({bats:input.bats,drawUint32:input.drawUint32,candidates:projected});
 const selected=selection.selectedIndex===null?null:entries[selection.selectedIndex];
 if(selected!==null&&(selected.reference===null||selected.candidate.status!=='PREDICTED_CONTACT'||selected.candidate.predictedContact===null))throw Error('selected registration differs');
 return Object.freeze({reference:selected?.reference??null,diagnostics:Object.freeze({version:'neutral_reactive_registration_v272' as const,
  status:selected?'PLANNED' as const:selection.status==='UNRESOLVED'?'UNRESOLVED' as const:'NO_FEASIBLE_CANDIDATE' as const,
  selection,selectedCandidate:selected?.candidate??null,selectedPreparationTransferCostMps:selected?.preparationTransferCostMps??null,
  candidates:Object.freeze(entries.map(entry=>Object.freeze({...entry.candidate,preparationTransferCostMps:entry.preparationTransferCostMps}))),
  actualWorldUsed:false as const,humanCalibration:'NOT_MEASURED' as const,earnedQualification:false as const})});
}
