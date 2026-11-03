import { expect,it } from 'vitest';
import { initialPitchHandHoldInput,type AcceptedInitialPitchHandHoldV1 } from './SqliteInitialPitchHandHoldStore';
const input=():AcceptedInitialPitchHandHoldV1=>({sourceId:'explicit-hand-successor',sourceVersion:'v1',capability:'owned_initial_pitch_hand_hold_v1',
  operationReference:{owner:'pa_observed_initial_v1_operations',sourceId:'original-decision',sourceHash:'1'.repeat(64),snapshotHash:'2'.repeat(64)},throughTick:1100000});
it('requires a pinned original operation and an explicit finite command without replacement state',()=>{
  const p=input(),v=initialPitchHandHoldInput(p,p.sourceId);expect(v).toEqual(p);expect(v).not.toBe(p);
  expect(()=>Object.assign(v,{throughTick:9999999})).toThrow();
  expect(()=>initialPitchHandHoldInput(p,'other-id')).toThrow();
});
it.each(['missing-deadline','fractional','negative','position','velocity','old-lease-override','bad-owner'] as const)('rejects %s',fault=>{
  const p=structuredClone(input());
  if(fault==='missing-deadline')Reflect.deleteProperty(p,'throughTick');
  if(fault==='fractional')Object.assign(p,{throughTick:1.5});
  if(fault==='negative')Object.assign(p,{throughTick:-1});
  if(fault==='position')Object.assign(p,{handCenter:{x:0,y:0,z:0}});
  if(fault==='velocity')Object.assign(p,{handVelocity:{x:0,y:0,z:0}});
  if(fault==='old-lease-override')Object.assign(p,{fromTick:0});
  if(fault==='bad-owner')Object.assign(p.operationReference,{owner:'caller-controller'});
  expect(()=>initialPitchHandHoldInput(p)).toThrow();
});
