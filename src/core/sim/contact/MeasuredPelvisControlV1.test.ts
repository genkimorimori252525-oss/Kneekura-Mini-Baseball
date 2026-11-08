import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { createMeasuredPelvisControlV1,type MeasuredPelvisControlV1 } from './MeasuredPelvisControlV1';
import { createHeldToMeasuredBatControlV1,createCoupledHeldMeasuredBatBodyControlV1,type CoupledHeldMeasuredBatBodyControlV1 } from './HeldToMeasuredBatControlV1';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';

const point=(x:number,y:number,z:number)=>({x,y,z});
const input=():CoupledHeldMeasuredBatBodyControlV1=>({version:'coupled_held_measured_bat_body_control_v1',bodyObstacleIndex:0,
  footObstacleIndices:[1,2],maximumLegReachM:1.6,
  bat:{version:'held_to_measured_bat_control_v1',bridgeStartTick:100000,throughTick:599999,
    initial:{version:'initial_held_bat_v1',startTick:0,throughTick:1000000,grip:point(.55,1.4,.05),orientation:{x:0,y:0,z:0,w:1},
      batLengthM:.84,maximumBatRadiusM:.034,handReferenceFromKnobM:.12},maximumSweetSpotSpeedMps:20,
    body:{bodyOrigin:point(0,1.5,0),maximumHandReachM:1.4,handCenter:point(.55,1.52,.05),handRadiusM:.06,
      obstacles:[{center:point(0,1.5,0),radiusM:.2},{center:point(-.1,.07,0),radiusM:.07},{center:point(.1,.07,0),radiusM:.07}]},
    measured:{provenance:{clipId:'explicit-synthetic-coupled-test',sourceSha256:'1'.repeat(64)},startTick:300000,ticksPerSecond:1000000,sourceTicksPerSecond:1000000,
      batLengthM:.84,sweetSpotT:.8,playbackRate:1,transform:{rotation:{x:0,y:0,z:0,w:1},translation:point(0,0,0),scale:1},
      frames:[{tick:0,grip:point(.55,1.4,.05),orientation:{x:0,y:0,z:0,w:1}},
        {tick:100000,grip:point(.25,1.5,.15),orientation:quaternionFromAxisAngle(point(0,0,1),.4)},
        {tick:200000,grip:point(-.2,1.55,.1),orientation:quaternionFromAxisAngle(point(0,0,1),.6)},
        {tick:300000,grip:point(-.55,1.5,.05),orientation:quaternionFromAxisAngle(point(0,0,1),.8)}]}},
  body:{version:'measured_pelvis_control_v1',startTick:0,bridgeStartTick:100000,throughTick:599999,initialCenter:point(0,1.5,0),maximumSpeedMps:5,
    reference:{provenance:{clipId:'explicit-synthetic-coupled-test',sourceSha256:'2'.repeat(64),batSourceSha256:'1'.repeat(64)},
      frames:[0,100000,200000,300000].map(tick=>({tick,leftHip:point(-.08,1.5,-.5),rightHip:point(.08,1.5,-.5)})),
      sourceTicksPerSecond:1000000,ticksPerSecond:1000000,startTick:300000,playbackRate:1,
      transform:{rotation:{x:0,y:0,z:0,w:1},translation:point(0,0,0),scale:1}}}});

it('retains every collider and original key while certifying a moving body instead of a false stationary body',()=>{
  const p=input(),before=structuredClone(p);
  expect(()=>createHeldToMeasuredBatControlV1(p.bat)).toThrow(/collision/);
  const m=createCoupledHeldMeasuredBatBodyControlV1(p);
  expect(p).toEqual(before);expect(m.input.bat.measured).toEqual(p.bat.measured);
  expect(m.certificate.originalObstacleCount).toBe(3);expect(m.certificate.nativeAdmission).toBe(false);
  expect(m.certificate.bodyCenterPolicy).toBe('HIP_MIDPOINT_PROXY_NOT_MEASURED_COM');
  expect(m.sampleBodyContinuous(500000).position).toEqual(point(0,1.5,-.5));
  expect(()=>m.sampleBodyContinuous(600000)).toThrow(/outside finite/);
});
it('joins actual initial body position/rest to original first position/velocity with C1 continuity',()=>{
  const p=structuredClone(input().body);
  Object.assign(p.reference.frames[1].leftHip,{x:p.reference.frames[1].leftHip.x+.02});
  Object.assign(p.reference.frames[1].rightHip,{x:p.reference.frames[1].rightHip.x+.02});
  const m=createMeasuredPelvisControlV1(p),at=m.sampleContinuous(p.reference.startTick),before=m.sampleContinuous(p.reference.startTick-.0001);
  expect(at.velocity.x).toBeCloseTo(.2,12);
  expect(m.sampleContinuous(p.bridgeStartTick).velocity).toEqual(point(0,0,0));
  expect(Math.hypot(...(['x','y','z'] as const).map(k=>before.position[k]-at.position[k]))).toBeLessThan(1e-8);
  expect(Math.hypot(...(['x','y','z'] as const).map(k=>before.velocity[k]-at.velocity[k]))).toBeLessThan(1e-7);
  expect(m.measuredCOM).toBe(false);expect(m.muscleTorqueCalibrated).toBe(false);
});
it('does not expose a mutable velocity used by future body samples or their speed certificate',()=>{
  const m=createMeasuredPelvisControlV1(input().body),original=m.sampleContinuous(400000);
  Object.assign(original.velocity,{x:999});
  expect(m.sampleContinuous(400000).velocity).toEqual(point(0,0,0));
  expect(m.maximumSpeedMps).toBeLessThan(5);
});
it.each(['clock','clip','keys','registration','initial','body-index','foot-index','leg-reach','speed','other-body'] as const)('rejects %s rather than removing obstacles or changing measurements',fault=>{
  const p=structuredClone(input());
  if(fault==='clock')Object.assign(p.body.reference,{startTick:300001});
  if(fault==='clip')Object.assign(p.body.reference.provenance,{clipId:'other'});
  if(fault==='keys')Object.assign(p.body.reference.frames[1],{tick:100001});
  if(fault==='registration')Object.assign(p.body.reference.transform,{rotation:quaternionFromAxisAngle(point(1,0,0),.1)});
  if(fault==='initial')Object.assign(p.body.initialCenter,{x:.01});
  if(fault==='body-index')Object.assign(p,{bodyObstacleIndex:1});
  if(fault==='foot-index')Object.assign(p,{footObstacleIndices:[0,1]});
  if(fault==='leg-reach')Object.assign(p,{maximumLegReachM:.3});
  if(fault==='speed')Object.assign(p.body,{maximumSpeedMps:1});
  if(fault==='other-body')Object.assign(p.bat.body,{obstacles:[...p.bat.body.obstacles,{center:point(0,1.5,-.5),radiusM:.1}]});
  expect(()=>createCoupledHeldMeasuredBatBodyControlV1(p)).toThrow();
});

it('uses original exact-key hip pairs for every existing real bat clip without a COM or native-admission claim',()=>{
  const bytes=readFileSync(new URL('../../../../docs/demos/measured-batter-pelvis-v1.json',import.meta.url),'utf8');
  type Frame=MeasuredPelvisControlV1['reference']['frames'][number]&{sourceRow:Record<string,string>};
  const data=JSON.parse(bytes) as {archiveMemberSha256:string;originalBatDatasetSha256:string;clips:{clipId:string;batSourceSha256:string;frames:Frame[]}[]};
  expect(createHash('sha256').update(readFileSync(new URL('../../../../docs/demos/measured-bat-motions.json',import.meta.url))).digest('hex')).toBe(data.originalBatDatasetSha256);
  expect(data.clips).toHaveLength(12);
  expect(data.clips.reduce((n,c)=>n+c.frames.length,0)).toBe(1644);
  for(const c of data.clips){
    for(const f of c.frames){
      for(const [prefix,p] of [['left_hip',f.leftHip],['right_hip',f.rightHip]] as const){
        expect(p).toEqual(point(Number(f.sourceRow[prefix+'_y']),Number(f.sourceRow[prefix+'_z']),Number(f.sourceRow[prefix+'_x'])));
      }
      const [sec,frac='']=f.sourceRow.time.split('.');expect(Number(BigInt(sec)*1000000n+BigInt(frac.padEnd(6,'0')))).toBe(f.tick);
    }
    const f=c.frames[0],initialCenter=point((f.leftHip.x+f.rightHip.x)/2,(f.leftHip.y+f.rightHip.y)/2,(f.leftHip.z+f.rightHip.z)/2);
    const m=createMeasuredPelvisControlV1({version:'measured_pelvis_control_v1',startTick:0,bridgeStartTick:100000,throughTick:200000+c.frames.at(-1)!.tick-f.tick-1,
      initialCenter,maximumSpeedMps:20,reference:{provenance:{clipId:c.clipId,sourceSha256:data.archiveMemberSha256,batSourceSha256:c.batSourceSha256},
        frames:c.frames.map(({tick,leftHip,rightHip})=>({tick,leftHip,rightHip})),sourceTicksPerSecond:1000000,ticksPerSecond:1000000,startTick:200000,
        playbackRate:1,transform:{rotation:{x:0,y:0,z:0,w:1},translation:point(0,0,0),scale:1}}});
    expect(m.nativeAdmission).toBe(false);expect(m.input.reference.frames[0]).toEqual({tick:f.tick,leftHip:f.leftHip,rightHip:f.rightHip});
  }
});
