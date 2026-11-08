import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { quantizeEventTick } from '../ExactEventTime';

const v=(x=0,y=0,z=0)=>({x,y,z});
// Authored reduced-order wall/control fixtures, not real stadium or legal policy.
function fixture(maxPlaySeconds=.0000001,tangentSpeed=2):LiveFieldPlayInputV1 {
  const tps=1e6,originTick=100000,elapsedSeconds=.123456789,radiusM=.0366;
  return {ball:{originTick,elapsedSeconds,ball:{tick:quantizeEventTick(originTick,elapsedSeconds,tps),
    position:v(0,radiusM,110-radiusM),velocity:v(tangentSpeed,0,.001),spin:v()}},
    physics:{kind:'aero_ground_v1',air:{ticksPerSecond:tps,integrationStepTicks:4000,gravityY:-9.81,
      aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},ground:{ticksPerSecond:tps,gravityMps2:9.81,
      radiusM,inertiaRatio:.378,restingVerticalSpeedMps:.15,material:{restitution:.4,slidingFriction:.25,
        rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}},
    field:{bases:{home:v(),first:v(19.39,0,19.39),second:v(0,0,38.78),third:v(-19.39,0,19.39)},
      fenceRadiusMeters:110,fenceHeightMeters:2},
    fielders:Array.from({length:9},(_,i)=>({playerId:`fielder-${i}`,position:v(-24+6*i,1,50),
      reactionSeconds:1,topSpeedMps:7,accelerationMps2:6,gloveSpeedMps:6,gloveReachMeters:1.3,gloveRadiusMeters:.1,
      transferSeconds:.25,throwSpeedMps:32,catchRetention:{ticksPerSecond:tps,ballMassKg:.145,ballRadiusMeters:radiusM,
        pocketRadiusMeters:.3,centerRetentionCapacityJ:150,captureDissipationPowerW:3000,failedContactRestitution:.2,
        failedTangentialDamping:.4,failedSpinDamping:.2}})),
    runners:[{runnerId:'batter',initialBase:0,topSpeedMps:8,accelerationMps2:5,reactionSeconds:.1}],outs:2,maxPlaySeconds};
}
function withPole(input:LiveFieldPlayInputV1,center={x:0,z:-35}):LiveFieldPlayInputV1 {
  return {...input,field:{...input.field,poleEquipmentV148:{version:'source_free_pole_session_v148',
    poles:[{surfaceId:'wall-window-pole',center,minimumHeight:0,maximumHeight:3,radiusM:.1}],
    materials:[{surfaceId:'wall-window-pole',material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]}}};
}

it('advances an actual supported arc through a positive same-tick window with a distant pole',()=>{
  const input=fixture(), baseline=simulateLiveFieldPlayV1(input), withEquipment=withPole(input), saved=JSON.stringify(withEquipment),
    actual=simulateLiveFieldPlayV1(withEquipment);
  expect(baseline.facts.some(f=>f.kind==='wall_support')).toBe(true);
  expect(actual.end.elapsedSeconds).toBe(baseline.end.elapsedSeconds);
  expect(actual.end.elapsedSeconds).toBeGreaterThan(input.ball.elapsedSeconds);
  expect(actual.end.tick).toBe(input.ball.ball.tick);
  expect(actual.frames).toEqual(baseline.frames);expect(actual.facts).toEqual(baseline.facts);
  expect(actual.diagnostics.wallSupports).toEqual(baseline.diagnostics.wallSupports);
  expect(actual.diagnostics.poleV148?.impulses).toHaveLength(0);
  expect(actual.diagnostics.poleV148?.constrainedWindowsV170?.length).toBeGreaterThan(0);
  expect(JSON.stringify(withEquipment)).toBe(saved);
});

it('keeps actual control cuts and a rolling-stop boundary ahead of the equipment query',()=>{
  for(const input of [fixture(.081),fixture(.003,.002)]) {
    const baseline=simulateLiveFieldPlayV1(input), actual=simulateLiveFieldPlayV1(withPole(input));
    expect(actual.frames).toEqual(baseline.frames);expect(actual.facts).toEqual(baseline.facts);expect(actual.end).toEqual(baseline.end);
    const windows=actual.diagnostics.poleV148?.constrainedWindowsV170??[];
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every(window=>window.throughElapsedSeconds-window.fromElapsedSeconds<=.040000000000001)).toBe(true);
    const territory=actual.facts.find(f=>f.kind==='territory_determined');
    if(input.maxPlaySeconds===.003) {
      expect(territory).toBeDefined();
      expect(windows.some(window=>window.throughElapsedSeconds===territory!.elapsedSeconds)).toBe(true);
    }
  }
});

it('keeps a near constrained pole and an initial tangent pole unresolved without a contact response',()=>{
  const input=fixture(.03);
  for(const x of [.14,.1+input.physics.ground.radiusM]) {
    const actual=simulateLiveFieldPlayV1(withPole(input,{x,z:110-input.physics.ground.radiusM}));
    expect(actual.end.elapsedSeconds).toBe(input.ball.elapsedSeconds);
    expect(actual.diagnostics.unresolvedDetail).toMatchObject({kind:x===.14
      ?'constrained_pole_motion_not_supported_v148':'pole_contact_order_v148'});
    if(x===.14)expect(actual.facts.some(f=>f.kind==='wall_support')).toBe(true);
    expect(actual.facts.filter(f=>f.kind==='pole_contact')).toEqual([]);
    expect(actual.diagnostics.poleV148?.impulses).toHaveLength(0);
    expect(actual.end.complete).toBe(false);
  }
});

it('does not let a far-pole proof run beyond an earlier actual body contact',()=>{
  const input=fixture(.15), first={...input.fielders[0],gloveRadiusMeters:.01,
    position:v(.2,input.physics.ground.radiusM,110-input.physics.ground.radiusM-.26)},
    authored={...input,fielders:[first,...input.fielders.slice(1)]},baseline=simulateLiveFieldPlayV1(authored),
    actual=simulateLiveFieldPlayV1(withPole(authored)), contact=baseline.facts.find(f=>f.kind==='body_contact');
  expect(contact,JSON.stringify({end:baseline.end,facts:baseline.facts,unresolved:baseline.diagnostics.unresolvedDetail})).toBeDefined();
  expect(actual.facts).toEqual(baseline.facts);expect(actual.end).toEqual(baseline.end);
  const windows=actual.diagnostics.poleV148?.constrainedWindowsV170??[];
  expect(windows.some(window=>window.throughElapsedSeconds===contact!.elapsedSeconds)).toBe(true);
});
