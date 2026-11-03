import {expect,it} from 'vitest';
import {sourceFieldV3Fixture as fixture} from './SourceBattedFieldMotionV3.test-support';
import {deriveSourceBattedFieldMotionV3} from './SourceBattedFieldMotionV3';
import {createSourceParkEquipmentV145,deriveSourceBattedFieldMotionV145,type SourceParkEquipmentV145} from './SourceBattedFieldMotionV145';
import {createSourceFreeBallKernel} from './SourceFreeBallKernel';
import {battedWorldBaseSurfaceId} from './BattedWorldFieldMotion';
const park=(x=2):SourceParkEquipmentV145=>({version:'source_park_equipment_v145',poles:[{
  geometry:{surfaceId:'explicit-pole',center:{x,z:0},minimumHeight:0,maximumHeight:3,radiusM:.1},
  material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]});

it('executes the earlier actual pole impulse then one certified departure using the original Source clock',()=>{
  const initial=fixture(),equipment=park(),before=JSON.stringify({initial,equipment});
  const trace=deriveSourceBattedFieldMotionV145({initial,parkEquipment:equipment,throughTicks:[212345,212345]});
  expect(trace.steps[0].field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'surface',surfaceId:'explicit-pole'}]});
  expect(trace.steps[0].field.motion.response.kind).toBe('rebound');expect(trace.impulseCertificates).toHaveLength(1);
  expect(trace.escapedIntervals).toHaveLength(1);expect(trace.field.motion.world.kind).toBe('moving');
  const cursor=trace.field.motion.cursor;if(!cursor?.sourceCurve)throw Error('actual continued Source required');
  expect(cursor.moment.originTick).toBe(initial.cursor.moment.originTick);
  expect(cursor.moment).toEqual(createSourceFreeBallKernel(cursor.sourceCurve).evaluateAt(.2).moment);
  expect(trace.parkEquipment).toEqual(equipment);expect(trace).not.toHaveProperty('officialResult');
  expect(JSON.stringify({initial,equipment})).toBe(before);
});
it('extends a later owned checkpoint horizon without losing the same-basis pole departure proof',()=>{
  const trace=deriveSourceBattedFieldMotionV145({initial:fixture(),parkEquipment:park(),throughTicks:[112345,212345]});
  expect(trace.field.motion.world.kind).toBe('moving');expect(trace.escapedIntervals).toHaveLength(1);
});
it('retains earlier panels and later independent panel or pole contacts instead of accumulating exclusions',()=>{
  const earlier=deriveSourceBattedFieldMotionV145({initial:fixture(),parkEquipment:park(3),throughTicks:[212345]});
  expect(earlier.impulseCertificates[0].diagnostic.colliderKey).toBe('["surface","right-wall"]');
  const panel=deriveSourceBattedFieldMotionV145({initial:fixture(false,true),parkEquipment:park(),throughTicks:[212345,212345,212345]});
  expect(panel.impulseCertificates.map(c=>c.diagnostic.colliderKey)).toEqual(['["surface","explicit-pole"]','["surface","left-wall"]']);
  const p=park(),other={...p.poles[0],geometry:{...p.poles[0].geometry,surfaceId:'other-pole',center:{x:.2,z:0}}};
  const two=deriveSourceBattedFieldMotionV145({initial:fixture(),parkEquipment:{...p,poles:[...p.poles,other]},throughTicks:[212345,212345,212345]});
  expect(two.impulseCertificates.map(c=>c.diagnostic.colliderKey)).toEqual(['["surface","explicit-pole"]','["surface","other-pole"]']);
  expect(two.field.motion.world.kind).toBe('moving');
});
it('retains the exact legacy field result when the explicit equipment has no poles',()=>{
  const initial=fixture(),throughTicks=[212345,212345];
  const old=deriveSourceBattedFieldMotionV3({initial,throughTicks});
  const next=deriveSourceBattedFieldMotionV145({initial,throughTicks,parkEquipment:{version:'source_park_equipment_v145',poles:[]}});
  expect(next.field).toEqual(old.field);expect(next.steps).toEqual(old.steps);
});
it('checks all pole materials and namespace membership even if a nearer object would be contacted first',()=>{
  const p=park(20),item=p.poles[0];
  expect(()=>createSourceParkEquipmentV145({...p,poles:[{...item,material:{...item.material,restitution:2}}]})).toThrow(/material/);
  expect(()=>createSourceParkEquipmentV145({...p,poles:[item,item]})).toThrow(/duplicate/);
  expect(()=>createSourceParkEquipmentV145({...p,poles:[{...item,geometry:{...item.geometry,surfaceId:battedWorldBaseSurfaceId('first')}}]})).toThrow(/reserved/);
  expect(()=>deriveSourceBattedFieldMotionV145({initial:fixture(),throughTicks:[],parkEquipment:{...p,poles:[{...item,geometry:{...item.geometry,surfaceId:'right-wall'}}]}})).toThrow(/aliases/);
});
it('rejects unsupported motion, expired coverage and injected certificates without executing an old positive-time query',()=>{
  const initial=fixture(),parkEquipment=park();
  expect(()=>deriveSourceBattedFieldMotionV145({initial,parkEquipment,throughTicks:[initial.coverageThroughTick+1]})).toThrow(/coverage/);
  const moving={...initial,commands:initial.commands.map(c=>({...c,acceleration:{x:1,y:0,z:0}}))};
  expect(()=>deriveSourceBattedFieldMotionV145({initial:moving,parkEquipment,throughTicks:[]})).toThrow(/stationary/);
  const raw={initial,parkEquipment,throughTicks:[],certificates:[]};
  expect(()=>deriveSourceBattedFieldMotionV145(raw)).toThrow(/scope/);
});
