import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { querySourceFreeBallWorldV2, querySourceFreeBallWorldWithPolesV136,
  type SourceFreeBallWorldQueryInputV2 } from './SourceFreeBallWorldQuery';
import type { SourceFreeBallPoleV136 } from './SourceFreeBallPoleV136';

const descriptor=():SourceFreeBallDescriptorV2=>({kind:'aero_ground_continuous_source_kernel_v2',
  initial:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:{x:0,y:1,z:0},velocity:{x:30,y:0,z:0},spin:{x:0,y:12,z:-50}}},throughElapsedSeconds:.1,
  profile:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:2000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
      material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}}});
const world=(d=descriptor()):SourceFreeBallWorldQueryInputV2=>({descriptor:d,moment:d.initial,side:'outgoing',throughElapsedSeconds:d.throughElapsedSeconds,actors:[],surfaces:[]});
const pole=(patch:Partial<SourceFreeBallPoleV136>={}):SourceFreeBallPoleV136=>({surfaceId:'explicit-synthetic-pole',center:{x:1,z:0},minimumHeight:0,maximumHeight:3,radiusM:.1,...patch});
const run=(p=pole(),w=world())=>querySourceFreeBallWorldWithPolesV136({world:w,poles:[p]});

it('queries an actual finite cylinder with the original nonlinear spin/velocity and no legal result',()=>{
  const w=world(),input={world:w,poles:[pole()]},before=JSON.stringify(input),r=querySourceFreeBallWorldWithPolesV136(input);
  expect(r.kind).toBe('boundary');if(r.kind!=='boundary')throw Error('expected actual cylindrical contact');
  expect(r.contacts).toHaveLength(1);expect(r.contacts[0]).toMatchObject({kind:'surface',surfaceId:pole().surfaceId});
  const c=r.contacts[0];if(c.kind!=='surface')throw Error('expected actual static surface');
  expect(Math.hypot(c.point.x-1,c.point.z)).toBeCloseTo(.1,11);
  expect(Math.hypot(r.moment.ball.position.x-c.point.x,r.moment.ball.position.y-c.point.y,r.moment.ball.position.z-c.point.z)).toBeCloseTo(.0366,10);
  expect(r.moment).toEqual(createSourceFreeBallKernel(w.descriptor).evaluateAt(r.moment.elapsedSeconds).moment);
  expect(r.moment.ball.spin).not.toEqual(w.descriptor.initial.ball.spin);expect(r).not.toHaveProperty('officialResult');
  expect(r).not.toHaveProperty('fair');expect(JSON.stringify(input)).toBe(before);
});

it('finds pole overlap wholly inside a 1ms interval rather than checking rendered endpoints',()=>{
  const original=descriptor(),d={...original,throughElapsedSeconds:.001,initial:{...original.initial,ball:{...original.initial.ball,
    velocity:{x:150,y:0,z:0},spin:{x:0,y:0,z:0}}}},p=pole({center:{x:.075,z:0},radiusM:.001});
  const kernel=createSourceFreeBallKernel(d);
  for(const t of [0,.001])expect(Math.abs(kernel.evaluateAt(t).moment.ball.position.x-.075)).toBeGreaterThan(.0376);
  const r=run(p,world(d));expect(r.kind).toBe('boundary');if(r.kind!=='boundary')throw Error('expected sub-frame contact');
  expect(r.moment.elapsedSeconds).toBeGreaterThan(0);expect(r.moment.elapsedSeconds).toBeLessThan(.001);
  expect(r.contacts[0]).toMatchObject({kind:'surface',surfaceId:p.surfaceId});
});

it('uses the flat top cap instead of treating the finite pole as a sphere or an infinite line',()=>{
  const original=descriptor(),d={...original,throughElapsedSeconds:.05,initial:{...original.initial,ball:{...original.initial.ball,
    position:{x:0,y:4,z:0},velocity:{x:0,y:-30,z:0},spin:{x:0,y:0,z:0}}}},r=run(pole({center:{x:0,z:0}}),world(d));
  expect(r.kind).toBe('boundary');if(r.kind!=='boundary')throw Error('expected cap contact');
  expect(r.contacts[0]).toMatchObject({kind:'surface',point:{x:0,y:3,z:0},normal:{x:0,y:1,z:0}});
  expect(r.moment.ball.position.y).toBeCloseTo(3.0366,11);
});

it.each([pole({center:{x:1,z:.5}}),pole({minimumHeight:3,maximumHeight:6}),pole({maximumHeight:.1})])('does not hit a cylinder outside its horizontal or vertical extent',p=>{
  expect(run(p).kind).toBe('moving');
});

it('retains an unresolved near-graze and does not force a clear or legal result',()=>{
  const original=descriptor(),d={...original,initial:{...original.initial,ball:{...original.initial.ball,
    position:{x:0,y:.0366,z:0},velocity:{x:0,y:0,z:0},spin:{x:0,y:0,z:0}}}},kernel=createSourceFreeBallKernel(d),
    r=run(pole({center:{x:.1366+5e-15,z:0}}),{...world(d),moment:kernel.evaluateAt(0,'outgoing').moment});
  expect(r).toMatchObject({kind:'unresolved',reason:'numerical_contact_refinement_required'});
  expect(r).not.toHaveProperty('officialResult');
});

it('does not let an unproven previous pole contact skip penetration or acquire an escape capability',()=>{
  const original=descriptor(),d={...original,initial:{...original.initial,ball:{...original.initial.ball,
    position:{x:1-.1-.0366+1e-15,y:1,z:0},velocity:{x:-30,y:0,z:0}}}},
    r=run(pole(),{...world(d),previousContacts:[{kind:'surface',surfaceId:pole().surfaceId}]});
  expect(r).toMatchObject({kind:'boundary',pendingReason:'persistent_contact'});
  expect(()=>run(pole(),{...world(d),previousContacts:[{kind:'surface',surfaceId:'undeclared'}]})).toThrow();
});

it('preserves earlier ground and fielder contact instead of choosing the pole by a named outcome',()=>{
  const original=descriptor(),d={...original,initial:{...original.initial,ball:{...original.initial.ball,
    position:{x:0,y:.0366001,z:0},velocity:{x:0,y:-1,z:0}}}},ground=run(pole({center:{x:100,z:0}}),world(d));
  expect(ground.kind).toBe('boundary');if(ground.kind!=='boundary')throw Error('expected ground');
  expect(ground.contacts.map(c=>c.kind)).toEqual(['ground']);
  const w=world(),caught=run(pole(),{...w,actors:[{playerId:'synthetic-fielder',primitive:{role:'glove',radius:.05,
    startTick:0,endTick:100000,ticksPerSecond:1e6,startCenter:{x:.5,y:1,z:0},startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}}}]});
  expect(caught.kind).toBe('boundary');if(caught.kind!=='boundary')throw Error('expected fielder');
  expect(caught.contacts[0]).toMatchObject({kind:'actor',playerId:'synthetic-fielder',role:'glove'});
});

it('retains the exact legacy result when no poles are supplied and never accepts poles through the V2 schema',()=>{
  const w=world();expect(querySourceFreeBallWorldWithPolesV136({world:w,poles:[]})).toEqual(querySourceFreeBallWorldV2(w));
  expect(()=>querySourceFreeBallWorldV2({...w,poles:[pole()]} as SourceFreeBallWorldQueryInputV2)).toThrow();
});

it.each([{panelX:.5,first:'synthetic-panel'},{panelX:1.5,first:'explicit-synthetic-pole'}])('uses event time rather than panel/pole array order at panel x=$panelX',({panelX,first})=>{
  const r=run(pole(),{...world(),surfaces:[{surfaceId:'synthetic-panel',start:{x:panelX,z:-1},end:{x:panelX,z:1},minimumHeight:0,maximumHeight:3}]});
  expect(r.kind).toBe('boundary');if(r.kind!=='boundary')throw Error('expected first static contact');
  expect(r.contacts).toHaveLength(1);expect(r.contacts[0]).toMatchObject({kind:'surface',surfaceId:first});
});

it('does not reconstruct an interior point through a cancelling center offset or invent its normal',()=>{
  const original=descriptor(),d={...original,initial:{...original.initial,ball:{...original.initial.ball,position:{x:.1,y:1,z:0}}}},
    r=run(pole({center:{x:1e4,z:0},radiusM:1e5}),{...world(d),throughElapsedSeconds:0});
  expect(r.kind).toBe('boundary');if(r.kind!=='boundary')throw Error('expected actual initial overlap');
  expect(r.contacts[0]).toMatchObject({kind:'surface',point:d.initial.ball.position,normal:null});
});

it.each([1e16,1e17])('rejects unrepresentable giant geometry instead of misclassifying inside/outside for radius %s',radiusM=>{
  expect(()=>run(pole({center:{x:1e16,z:0},radiusM}),{...world(),throughElapsedSeconds:0})).toThrow('technical coordinate range');
});

it('rejects aliases, invalid geometry, unsupported fields and an invented moment',()=>{
  const w=world(),p=pole();
  for(const bad of [pole({radiusM:0}),pole({radiusM:NaN}),pole({maximumHeight:0}),pole({minimumHeight:-1}),pole({surfaceId:' '}),
    pole({center:{x:Number.MAX_VALUE,z:0},radiusM:Number.MAX_VALUE}),pole({center:{x:1e12,z:0},radiusM:1e-9})])expect(()=>run(bad,w)).toThrow();
  expect(()=>querySourceFreeBallWorldWithPolesV136({world:w,poles:[p,p]})).toThrow();
  expect(()=>run(p,{...w,surfaces:[{surfaceId:p.surfaceId,start:{x:1,z:-1},end:{x:1,z:1},minimumHeight:0,maximumHeight:3}]})).toThrow();
  expect(()=>querySourceFreeBallWorldWithPolesV136({...{world:w,poles:[p]},fair:true} as never)).toThrow();
  expect(()=>run(p,{...w,moment:{...w.moment,ball:{...w.moment.ball,velocity:{x:999,y:0,z:0}}}})).toThrow();
});
