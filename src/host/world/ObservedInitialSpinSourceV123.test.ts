import {expect,it} from 'vitest';
import {observedInitialSourceInput} from './SqliteObservedInitialPitchStore';
const ref=(owner:string)=>({owner,sourceId:owner+'-source',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
const original=()=>({sourceId:'initial-decision',sourceVersion:'v1',capability:'same_pa_observed_initial_decision_v1',
 launchReference:ref('pa_dispatch_v1_pitch_actions'),previousOperationReference:ref('pa_observed_initial_v1_operations'),
 opportunityReference:ref('pa_observed_initial_v1_operations'),emotionReference:ref('batting_emotion_execution_v1_executions'),
 decisionCalibrationReference:ref('pa_dispatch_v1_execution_calibrations'),motorCalibrationReference:ref('pa_dispatch_v1_execution_calibrations'),
 repertoireCalibrationReference:ref('pa_dispatch_v1_execution_calibrations'),expectedWorld:{careerId:'career',worldRevision:1,controlRevision:0,controlHash:'c'.repeat(64)},attempt:'ordinary_swing'});
const spin=()=>({kind:'fixed_native_spin_binding_v123',modelReference:ref('world_player_batting_models'),
 intent:{technique:'BACKSPIN',selectedAtTick:100},qualificationReferences:[ref('world_spin_mastery_v123')]});
it('keeps the old initial decision Source exact and rejects backfilled skill data',()=>{
 const old=original(),bytes=JSON.stringify(old);expect(observedInitialSourceInput(old)).toEqual(old);expect(JSON.stringify(observedInitialSourceInput(old))).toBe(bytes);
 expect(()=>observedInitialSourceInput({...old,spinBindingV123:spin()})).toThrow();expect(JSON.stringify(old)).toBe(bytes);
});
it('accepts an explicit versioned fixed binding without renaming the original initial-pitch chain',()=>{
 const source={...original(),capability:'same_pa_observed_initial_decision_v123',spinBindingV123:spin()};
 expect(observedInitialSourceInput(source)).toEqual(source);expect(Object.isFrozen(observedInitialSourceInput(source))).toBe(true);
});
it('rejects raw qualification payloads, extra physical multipliers and missing or duplicate fixed references',()=>{
 const source={...original(),capability:'same_pa_observed_initial_decision_v123',spinBindingV123:spin()};
 expect(observedInitialSourceInput(source)).toEqual(source);
 for(const bad of [{...source,spinBindingV123:undefined},{...source,spinBindingV123:{...spin(),exitSpinMultiplier:2}},
  {...source,spinBindingV123:{...spin(),qualificationReferences:[...spin().qualificationReferences,...spin().qualificationReferences]}},
  {...source,spinBindingV123:{...spin(),qualificationReferences:[{...ref('world_spin_mastery_v123'),mastered:true}]}}])
  expect(()=>observedInitialSourceInput(bad)).toThrow();
});
