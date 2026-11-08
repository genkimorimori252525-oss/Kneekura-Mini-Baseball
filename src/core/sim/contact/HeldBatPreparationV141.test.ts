import {expect,it} from 'vitest';
import {createHeldToMeasuredBatControlV1} from './HeldToMeasuredBatControlV1';
import {createReferenceBatKinematicsV1} from './ReferenceBatKinematicsV1';

const zero={x:0,y:0,z:0},upright={...zero,w:1};
const input=()=>({version:'held_to_measured_bat_control_v141' as const,bridgeStartTick:100000,throughTick:599999,
  preparationV141:{version:'explicit_bat_preparation_waypoints_v141' as const,
    waypoints:[{tick:200000,grip:{x:0,y:1.5,z:0},orientation:upright}]},
  initial:{version:'initial_held_bat_v1' as const,startTick:0,throughTick:1000000,grip:{x:-.55,y:.95,z:0},orientation:upright,
    batLengthM:.84,maximumBatRadiusM:.034,handReferenceFromKnobM:.12},
  body:{bodyOrigin:{x:0,y:.95,z:0},maximumHandReachM:1.4,handCenter:{x:-.55,y:1.07,z:0},handRadiusM:.06,
    obstacles:[{center:{x:0,y:.95,z:0},radiusM:.2}]},maximumSweetSpotSpeedMps:20,
  measured:{provenance:{clipId:'explicit-synthetic-body-route-v141',sourceSha256:'1'.repeat(64)},startTick:300000,ticksPerSecond:1000000,sourceTicksPerSecond:1000000,
    batLengthM:.84,sweetSpotT:.8,playbackRate:1,transform:{rotation:upright,translation:zero,scale:1},
    frames:[{tick:0,grip:{x:.55,y:.95,z:0},orientation:upright},{tick:300000,grip:{x:.55,y:.95,z:0},orientation:upright}]}});

it('certifies an explicit C1 route around the same body that the original direct bridge intersects',()=>{
  const p=input(),before=structuredClone(p),{preparationV141:_,...old}=p;
  expect(()=>createHeldToMeasuredBatControlV1({...old,version:'held_to_measured_bat_control_v1'})).toThrow(/collision/);
  const motion=createHeldToMeasuredBatControlV1(p),measured=createReferenceBatKinematicsV1(p.measured);
  expect(p).toEqual(before);expect(motion.input.measured).toEqual(before.measured);
  expect(motion.certificate.nativeAdmission).toBe(false);
  expect(motion.sampleContinuous(200000).state.pose.grip).toEqual(p.preparationV141.waypoints[0].grip);
  for(const tick of [p.bridgeStartTick,200000,p.measured.startTick]){
    const center=motion.sampleContinuous(tick),lo=motion.sampleContinuous(tick-.001),hi=motion.sampleContinuous(tick+.001);
    for(const key of ['x','y','z'] as const){
      expect(Math.abs(lo.state.pose.grip[key]-center.state.pose.grip[key])).toBeLessThan(1e-7);
      expect(Math.abs(hi.state.pose.grip[key]-center.state.pose.grip[key])).toBeLessThan(1e-7);
      expect(Math.abs(lo.state.linearVelocity[key]-hi.state.linearVelocity[key])).toBeLessThan(1e-5);
      expect(Math.abs(lo.state.angularVelocity[key]-hi.state.angularVelocity[key])).toBeLessThan(1e-5);
    }
  }
  for(const tick of [300000,400000.5,599999])expect(motion.sampleContinuous(tick).state).toEqual(measured.sampleContinuous(tick).state);
});

it.each(['empty','early','late','unsorted','bad-pose','collision','speed','reach','legacy-extension'] as const)('rejects %s without changing obstacles, measured keys or limits',fault=>{
  const p=input(),w=p.preparationV141.waypoints[0];
  if(fault==='empty')p.preparationV141.waypoints=[];
  if(fault==='early')w.tick=p.bridgeStartTick;
  if(fault==='late')w.tick=p.measured.startTick;
  if(fault==='unsorted')p.preparationV141.waypoints=[w,{...w,tick:w.tick-1}];
  if(fault==='bad-pose')w.orientation={...upright,w:2};
  if(fault==='collision')w.grip={x:0,y:.95,z:0};
  if(fault==='speed')p.maximumSweetSpotSpeedMps=1;
  if(fault==='reach'){w.grip={x:0,y:3,z:0};p.maximumSweetSpotSpeedMps=1000;}
  expect(()=>createHeldToMeasuredBatControlV1(fault==='legacy-extension'?{...p,version:'held_to_measured_bat_control_v1'}:p))
    .toThrow(fault==='reach'?/reach/:fault==='speed'?/speed/:undefined);
});

it.each([null,false,0,''])('rejects an explicitly malformed route %j instead of falling back to the legacy bridge',preparationV141=>{
  const raw=JSON.parse(JSON.stringify({...input(),preparationV141}));
  expect(()=>createHeldToMeasuredBatControlV1(raw)).toThrow(/explicit preparation/);
});
