import {expect,it} from 'vitest';
import {sourceFieldV3Fixture} from './SourceBattedFieldMotionV3.test-support';
import {createSourceFreeBallKernel,createContinuousBattedBallFlightEvidence} from './SourceFreeBallKernel';
import {deriveSourceBattedFieldMotionV145} from './SourceBattedFieldMotionV145';
import {querySourceFenceOverflightV146,type SourceFenceOverflightQueryInputV146} from './SourceFenceOverflightV146';
import {deriveSourceBattedFieldFenceTraceV146} from './SourceBattedFieldFenceTraceV146';
const policy:SourceFenceOverflightQueryInputV146['policy']={version:'finite_fence_sphere_transit_v1',crossing:'whole_ball_outside',
  endpoints:'strict_sphere_inside_else_unresolved',top:'strict_sphere_above_during_transit_else_unresolved',ground:'stop_at_first_ground'};
const fixture=()=>{
  const initial=sourceFieldV3Fixture();initial.response.world.surfaces[0].maximumHeight=.2;
  return{initial,throughTicks:[212345],parkEquipment:{version:'source_park_equipment_v145' as const,poles:[]},
    fences:[{fence:{boundaryId:'right-boundary',surface:initial.response.world.surfaces[0],interiorPoint:{x:0,z:0}},policy}]};
};
it('joins an actual uninterrupted Source field prefix to a finite-fence witness without changing physics or awarding a result',()=>{
  const q=fixture(),before=JSON.stringify(q),result=deriveSourceBattedFieldFenceTraceV146(q);
  expect(result.physical).toEqual(deriveSourceBattedFieldMotionV145({initial:q.initial,throughTicks:q.throughTicks,parkEquipment:q.parkEquipment}));
  expect(result.intervals).toHaveLength(1);expect(result.intervals[0]).toMatchObject({afterStepIndex:0,results:[{kind:'witness',boundaryId:'right-boundary'}]});
  const witness=result.intervals[0].results[0];if(witness.kind!=='witness')throw Error('actual witnessed transit required');
  const kernel=createSourceFreeBallKernel({...q.initial.cursor.sourceCurve,throughElapsedSeconds:.2});
  expect(witness.exit.moment).toEqual(kernel.evaluateAt(witness.exit.witnessElapsedSeconds,'incoming').moment);
  expect(result).not.toHaveProperty('officialResult');expect(result).not.toHaveProperty('homeRun');expect(JSON.stringify(q)).toBe(before);
});
it.each(['actor','pole'] as const)('caps the same incoming basis at the earlier actual %s instead of witnessing its unused future',kind=>{
  const q=fixture();
  const equipment=kind==='pole'?{...q.parkEquipment,poles:[{geometry:{surfaceId:'early-pole',center:{x:1.6,z:0},minimumHeight:0,maximumHeight:4,radiusM:.1},
    material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]}:q.parkEquipment;
  if(kind==='actor')q.initial.actors[0].primitive.startCenter={x:1.6,y:1,z:0};
  const hypothetical=querySourceFenceOverflightV146({descriptor:{...q.initial.cursor.sourceCurve,throughElapsedSeconds:.2},moment:q.initial.cursor.moment,
    side:'incoming',throughElapsedSeconds:.2,...q.fences[0]});expect(hypothetical.kind).toBe('witness');
  const result=deriveSourceBattedFieldFenceTraceV146({...q,throughTicks:[212345,212345],parkEquipment:equipment});
  expect(result.physical.steps[0].field.motion.world).toMatchObject({kind:'boundary',contacts:[expect.objectContaining({kind:kind==='pole'?'surface':'actor'})]});
  expect(result.intervals.every(i=>i.results.every(r=>r.kind!=='witness'))).toBe(true);
  expect(result.intervals[0].throughElapsedSeconds).toBe(result.physical.steps[0].field.motion.world.moment.elapsedSeconds);
});
it('retains the first ground boundary across later outgoing checkpoints',()=>{
  const q=fixture();q.initial.response.world.surfaces[0].start.x=100;q.initial.response.world.surfaces[0].end.x=100;
  const curve=q.initial.cursor.sourceCurve;
  const contact={...q.initial.response.world.flight.contact,ballCenter:{x:1,y:.05,z:0},exitVelocity:{x:1,y:-1,z:0}},
    flight=createContinuousBattedBallFlightEvidence(contact,0,curve.profile),sourceCurve={...curve,initial:{...curve.initial,ball:flight.initialBall}};
  const initial={...q.initial,response:{...q.initial.response,world:{...q.initial.response.world,flight,sourceCurve}},
    cursor:{...q.initial.cursor,moment:sourceCurve.initial,sourceCurve}};
  const result=deriveSourceBattedFieldFenceTraceV146({...q,initial,throughTicks:[212345,212345]});
  expect(result.physical.steps[0].field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'ground'}]});
  expect(result.intervals).toHaveLength(2);
  expect(result.intervals.every(i=>i.results.every(r=>r.kind==='blocked_by_ground'))).toBe(true);
});
it('validates every exact original fence and policy even for an unused zero-length field request',()=>{
  const q=fixture(),definition=q.fences[0];
  for(const patch of [{fence:{...definition.fence,surface:{...definition.fence.surface,maximumHeight:.3}}},
    {fence:{...definition.fence,surface:{...definition.fence.surface,surfaceId:'absent'}}},
    {policy:{...policy,top:'ignore'}}])expect(()=>deriveSourceBattedFieldFenceTraceV146({...q,throughTicks:[],fences:[{...definition,...patch} as typeof definition]})).toThrow();
  expect(()=>deriveSourceBattedFieldFenceTraceV146({...q,fences:[definition,definition]})).toThrow();
  const raw={...q,impulseCertificates:[]};expect(()=>deriveSourceBattedFieldFenceTraceV146(raw)).toThrow();
});
it('keeps the same uninterrupted transit when an ordinary checkpoint lands between entry and exit',()=>{
  const q=fixture(),single=deriveSourceBattedFieldFenceTraceV146(q),r=single.intervals[0].results[0];
  if(r.kind!=='witness')throw Error('actual single-interval witness required');
  const tick=q.initial.cursor.moment.originTick+Math.floor((r.entry.witnessElapsedSeconds+r.exit.firstPossibleElapsedSeconds)*.5*1_000_000),
    time=(tick-q.initial.cursor.moment.originTick)/1_000_000;
  expect(time).toBeGreaterThan(r.entry.witnessElapsedSeconds);expect(time).toBeLessThan(r.exit.firstPossibleElapsedSeconds);
  const split=deriveSourceBattedFieldFenceTraceV146({...q,throughTicks:[tick,212345]});
  expect(split.physical.field).toEqual(single.physical.field);
  expect(split.intervals.at(-1)!.results[0]).toEqual(r);
});
it('carries the first actual ground across a later pole impulse basis rather than reviving an airborne witness',()=>{
  const q=fixture(),old=q.initial.cursor.sourceCurve;
  q.initial.response.world.surfaces[0].maximumHeight=.01;
  const contact={...q.initial.response.world.flight.contact,exitVelocity:{x:30,y:-10,z:0}},
    flight=createContinuousBattedBallFlightEvidence(contact,0,old.profile),sourceCurve={...old,initial:{...old.initial,ball:flight.initialBall}},
    initial={...q.initial,response:{...q.initial.response,world:{...q.initial.response.world,flight,sourceCurve}},cursor:{...q.initial.cursor,moment:sourceCurve.initial,sourceCurve}};
  const result=deriveSourceBattedFieldFenceTraceV146({...q,initial,throughTicks:[512345,512345,512345],
    parkEquipment:{...q.parkEquipment,poles:[{geometry:{surfaceId:'after-ground-pole',center:{x:4,z:0},minimumHeight:0,maximumHeight:4,radiusM:.1},
      material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]},fences:[{...q.fences[0],fence:{...q.fences[0].fence,interiorPoint:{x:10,z:0}}}]});
  expect(result.physical.steps[0].field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'ground'}]});
  expect(result.physical.steps[1].field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'surface',surfaceId:'after-ground-pole'}]});
  expect(result.intervals[2].descriptor.initial.elapsedSeconds).toBeGreaterThan(result.physical.steps[0].field.motion.world.moment.elapsedSeconds);
  expect(result.intervals[2].results[0]).toMatchObject({kind:'blocked_by_ground',moment:result.physical.steps[0].field.motion.world.moment});
});
it('keeps a fence exit pending if its numerical bracket overlaps the earliest possible physical contact',()=>{
  const q=fixture();q.initial.actors[0].primitive.startCenter={x:2,y:1,z:0};
  const actual=deriveSourceBattedFieldMotionV145({initial:q.initial,throughTicks:q.throughTicks,parkEquipment:q.parkEquipment}),
    diagnostic=actual.impulseCertificates[0].diagnostic,through=actual.steps[0].field.motion.world.moment.elapsedSeconds,
    descriptor={...q.initial.cursor.sourceCurve,throughElapsedSeconds:.2},kernel=createSourceFreeBallKernel(descriptor),radius=descriptor.profile.ground.radiusM;
  expect(diagnostic.firstPossibleElapsedSeconds).toBeLessThan(through);
  const choices=[.1,.25,.5,.75,.9].map(fraction=>{
    const time=diagnostic.firstPossibleElapsedSeconds+fraction*(through-diagnostic.firstPossibleElapsedSeconds),x=kernel.evaluateAt(time).moment.ball.position.x-radius,
      surface={...q.fences[0].fence.surface,start:{x,z:-1},end:{x,z:1}},definition={...q.fences[0],fence:{...q.fences[0].fence,surface}};
    const result=querySourceFenceOverflightV146({descriptor,moment:q.initial.cursor.moment,side:'incoming',throughElapsedSeconds:through,...definition});
    return{definition,result};
  });
  const choice=choices.find(c=>c.result.kind==='witness'&&c.result.exit.witnessElapsedSeconds>=diagnostic.firstPossibleElapsedSeconds
    &&c.result.exit.witnessElapsedSeconds<through);
  expect(choice,'an actual overlapping contact/fence bracket is required').toBeDefined();
  if(!choice)throw Error('overlapping bracket fixture missing');
  const initial={...q.initial,response:{...q.initial.response,world:{...q.initial.response.world,surfaces:[choice.definition.fence.surface]}}};
  const result=deriveSourceBattedFieldFenceTraceV146({...q,initial,fences:[choice.definition]});
  expect(result.intervals[0].results[0]).toMatchObject({kind:'unresolved',reason:'physical_boundary_order_unproved'});
});
