import { expect,it } from 'vitest';
import { initialJointPhysicalSourceInput } from './SqliteInitialJointPhysicalExecutionStore';
const ref={owner:'pa_initial_joint_v1_rights',sourceId:'right',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)};
const execution={sourceId:'execute',sourceVersion:'test-v1',capability:'initial_joint_physical_execution_v1',rightReference:ref};
it('accepts an explicit execution referencing an owned right and detaches it',()=>{
  const input=structuredClone(execution),value=initialJointPhysicalSourceInput(input,'execute');
  expect(value).toEqual(execution);expect(Object.isFrozen(value)).toBe(true);
  input.rightReference.sourceHash='c'.repeat(64);expect(value).toEqual(execution);
});
it.each([
  ['id',{sourceId:'else'}],['kind',{capability:'ordinary_swing'}],['injected result',{result:{kind:'bat_contact'}}],
  ['injected effort',{effortUnits:0}],['injected aim',{aim:{x:0,y:1,z:0}}],['foreign owner',{rightReference:{...ref,owner:'pa_dispatch_v1_rights'}}],
  ['bad right hash',{rightReference:{...ref,sourceHash:'bad'}}],['missing right',{rightReference:null}],
])('refuses %s',(name,changes)=>{expect(name).toBeTruthy();expect(()=>initialJointPhysicalSourceInput({...execution,...changes},'execute')).toThrow();});
it('does not accept a caller outcome or fractional clock in a prospective right',()=>{
  const right={sourceId:'right',sourceVersion:'test-v1',capability:'initial_joint_physical_right_v1',calculation:{controls:{},throughTick:100}};
  expect(()=>initialJointPhysicalSourceInput({...right,calculation:{...right.calculation,contact:{}}})).toThrow();
  expect(()=>initialJointPhysicalSourceInput({...right,calculation:{...right.calculation,throughTick:100.5}})).toThrow();
});
