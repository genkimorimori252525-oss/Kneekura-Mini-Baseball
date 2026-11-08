import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { deriveSourceBattedFieldMotionV3 } from './SourceBattedFieldMotionV3';
import { sourceFieldV3Fixture as fixture } from './SourceBattedFieldMotionV3.test-support';
const v=(x=0,y=0,z=0)=>({x,y,z});
it('replays a real fractional wall impulse then certified escape with one original Source clock and full-horizon kernel equality',()=>{
  const x=fixture(),tick=212345,trace=deriveSourceBattedFieldMotionV3({initial:x,throughTicks:[tick,tick]});
  expect(trace.steps[0].field.motion.response.kind).toBe('rebound');
  expect(trace.steps[1].field.motion.world.kind).toBe('moving');
  expect(trace.impulseCertificates).toHaveLength(1);expect(trace.escapedIntervals).toHaveLength(1);
  const cursor=trace.field.motion.cursor!;
  expect(cursor.moment.originTick).toBe(x.cursor.moment.originTick);
  expect(cursor.sourceCurve!.initial).toEqual(trace.steps[0].field.motion.cursor!.moment);
  expect(cursor.moment).toEqual(createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(0.2).moment);
});
it('certifies separate successive colliders while searching earlier colliders again instead of accumulating exclusions',()=>{
  const x=fixture(false,true),trace=deriveSourceBattedFieldMotionV3({initial:x,throughTicks:[412345,412345,412345]});
  expect(trace.impulseCertificates.map(c=>c.diagnostic.colliderKey)).toEqual(['["surface","right-wall"]','["surface","left-wall"]']);
  expect(trace.steps[1].field.motion.cursor!.previousContacts).toEqual([{kind:'surface',surfaceId:'left-wall'}]);
  expect(trace.field.motion.world.kind).toBe('moving');
});
it('retains original base contact identity/material and rejects replacement body motion, malformed horizons or an interrupted caller prefix',()=>{
  const x=fixture(true),trace=deriveSourceBattedFieldMotionV3({initial:x,throughTicks:[212345,212345]});
  expect(trace.steps[0].field.baseContacts[0].baseId).toBe('first');
  expect(trace.impulseCertificates[0].diagnostic.colliderKey).toBe('["base","first"]');
  expect(trace.field.motion.world.kind).toBe('moving');
  expect(()=>deriveSourceBattedFieldMotionV3({initial:{...x,commands:x.commands.map(c=>({...c,acceleration:v(1)}))},throughTicks:[]})).toThrow('stationary');
  expect(()=>deriveSourceBattedFieldMotionV3({initial:x,throughTicks:[1]})).toThrow();
  expect(()=>deriveSourceBattedFieldMotionV3({...{initial:x,throughTicks:[]},certificates:trace.impulseCertificates} as never)).toThrow();
});
