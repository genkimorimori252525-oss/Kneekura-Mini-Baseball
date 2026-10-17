import { expect,it } from 'vitest';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { createReferenceBatKinematicsV1 } from './ReferenceBatKinematicsV1';
import { createHeldToMeasuredBatControlV1,type HeldToMeasuredBatControlV1 } from './HeldToMeasuredBatControlV1';

const input=():HeldToMeasuredBatControlV1=>({version:'held_to_measured_bat_control_v1',bridgeStartTick:100000,throughTick:599999,
  initial:{version:'initial_held_bat_v1',startTick:0,throughTick:1000000,grip:{x:.55,y:1.4,z:.05},orientation:{x:0,y:0,z:0,w:1},
    batLengthM:.84,maximumBatRadiusM:.034,handReferenceFromKnobM:.12},
  body:{bodyOrigin:{x:0,y:.95,z:0},maximumHandReachM:1.4,handCenter:{x:.55,y:1.52,z:.05},handRadiusM:.06,
    obstacles:[{center:{x:0,y:.95,z:0},radiusM:.25}]},maximumSweetSpotSpeedMps:20,
  measured:{provenance:{clipId:'explicit-synthetic-control-test',sourceSha256:'1'.repeat(64)},startTick:300000,ticksPerSecond:1000000,sourceTicksPerSecond:1000000,
    batLengthM:.84,sweetSpotT:.8,playbackRate:1,transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1},
    frames:[{tick:0,grip:{x:.55,y:1.4,z:.05},orientation:{x:0,y:0,z:0,w:1}},
      {tick:100000,grip:{x:.25,y:1.5,z:.15},orientation:quaternionFromAxisAngle({x:0,y:0,z:1},.4)},
      {tick:200000,grip:{x:-.2,y:1.55,z:.1},orientation:quaternionFromAxisAngle({x:0,y:0,z:1},.6)},
      {tick:300000,grip:{x:-.55,y:1.5,z:.05},orientation:quaternionFromAxisAngle({x:0,y:0,z:1},.8)}]}});

it('joins held pose to original first measured pose/linear/angular velocity without changing keys or registration',()=>{
  const p=input(),before=structuredClone(p),m=createHeldToMeasuredBatControlV1(p),original=createReferenceBatKinematicsV1(p.measured);
  expect(p).toEqual(before);expect(m.input.measured).toEqual(before.measured);
  expect(m.certificate.nativeAdmission).toBe(false);expect(m.certificate.measuredKeysChanged).toBe(false);
  expect(m.sampleContinuous(p.bridgeStartTick).state.linearVelocity).toEqual({x:0,y:0,z:0});
  expect(m.sampleContinuous(p.bridgeStartTick).state.angularVelocity).toEqual({x:0,y:0,z:0});
  const near=m.sampleContinuous(p.measured.startTick-.0001),target=original.sample(p.measured.startTick);
  for(const k of ['x','y','z'] as const){
    expect(Math.abs(near.state.pose.grip[k]-target.state.pose.grip[k])).toBeLessThan(1e-7);
    expect(Math.abs(near.state.linearVelocity[k]-target.state.linearVelocity[k])).toBeLessThan(1e-6);
    expect(Math.abs(near.state.angularVelocity[k]-target.state.angularVelocity[k])).toBeLessThan(1e-6);
  }
  expect(m.sampleContinuous(p.measured.startTick).state).toEqual(target.state);
  expect(m.sampleContinuous(410000.5).state).toEqual(original.sampleContinuous(410000.5).state);
});
it('samples at continuous collision times while retaining integer-only legacy observation',()=>{
  const p=input(),original=createReferenceBatKinematicsV1(p.measured);
  expect(()=>original.sample(310000.5)).toThrow(/observation tick/);
  expect(original.sampleContinuous(310000.5).tick).toBe(310000.5);
  expect(createHeldToMeasuredBatControlV1(p).sampleContinuous(200000.5).phase).toBe('bridge');
});
it('certifies local speed bounds without adding extrema attained at different bridge times',()=>{
  const p=structuredClone(input());
  Object.assign(p.initial,{orientation:quaternionFromAxisAngle({x:0,y:0,z:1},-Math.PI/2)});
  Object.assign(p.body,{handCenter:{x:.67,y:1.4,z:.05}});
  const m=createHeldToMeasuredBatControlV1(p);
  expect(m.certificate.sweetSpeedUpperBoundMps).toBeLessThan(p.maximumSweetSpotSpeedMps);
  const radius=p.initial.batLengthM*p.measured.sweetSpotT;
  for(let i=0;i<=1000;i++){
    const s=m.sampleContinuous(p.bridgeStartTick+(p.measured.startTick-p.bridgeStartTick)*i/1000).state;
    const a={x:(s.pose.tip.x-s.pose.grip.x)/p.initial.batLengthM,y:(s.pose.tip.y-s.pose.grip.y)/p.initial.batLengthM,z:(s.pose.tip.z-s.pose.grip.z)/p.initial.batLengthM};
    const v=s.linearVelocity,w=s.angularVelocity;
    const speed=Math.hypot(v.x+radius*(w.y*a.z-w.z*a.y),v.y+radius*(w.z*a.x-w.x*a.z),v.z+radius*(w.x*a.y-w.y*a.x));
    expect(speed).toBeLessThanOrEqual(m.certificate.sweetSpeedUpperBoundMps);
  }
});
it.each(['expired','late-bridge','speed','reach','body','scale','terminal-rest'] as const)('refuses %s instead of retiming or moving original keys',fault=>{
  const p=structuredClone(input());
  if(fault==='expired')Object.assign(p,{throughTick:p.initial.throughTick+1});
  if(fault==='late-bridge')Object.assign(p,{bridgeStartTick:p.measured.startTick});
  if(fault==='speed')Object.assign(p,{maximumSweetSpotSpeedMps:1});
  if(fault==='reach')Object.assign(p.body,{maximumHandReachM:.7});
  if(fault==='body')Object.assign(p.body,{obstacles:[{center:p.measured.frames[1].grip,radiusM:.03}]});
  if(fault==='scale')Object.assign(p.measured.transform,{scale:1.1});
  if(fault==='terminal-rest')Object.assign(p,{throughTick:600000});
  expect(()=>createHeldToMeasuredBatControlV1(p)).toThrow();
});
it('stops at its actual lease rather than inventing a final stationary pose',()=>{
  const p=input(),m=createHeldToMeasuredBatControlV1(p);
  expect(()=>m.sampleContinuous(p.throughTick+1)).toThrow(/outside finite/);
  expect(m.sampleContinuous(p.throughTick).state.linearVelocity).not.toEqual({x:0,y:0,z:0});
  expect(m.certificate.terminalRestInvented).toBe(false);
});
it('certifies a finite prefix without claiming clearance for later measured motion',()=>{
  const p=structuredClone(input());
  Object.assign(p.body,{obstacles:[{center:p.measured.frames[2].grip,radiusM:.03}]});
  expect(()=>createHeldToMeasuredBatControlV1(p)).toThrow(/collision/);
  const prefix=createHeldToMeasuredBatControlV1({...p,throughTick:350000});
  expect(prefix.input.measured).toEqual(p.measured);
  expect(prefix.sampleContinuous(350000).phase).toBe('measured');
  expect(()=>prefix.sampleContinuous(350001)).toThrow(/outside finite/);
});
