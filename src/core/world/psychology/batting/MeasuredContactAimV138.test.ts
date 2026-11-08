import {expect,it} from 'vitest';
import {measuredFixture} from './MeasuredBattingFixtures.test-support';
import {prepareBattingExecution} from './BattingCommitment';
import {createReferenceBatKinematicsV1} from '../../../sim/contact/ReferenceBatKinematicsV1';

const version='measured_bat_field_contact_aim_repertoire_v138';
const aim=(lateralOffsetM=0,verticalOffsetM=0,maximumOffsetM=.02)=>({
  version:'measured_bat_contact_aim_v138',lateralOffsetM,verticalOffsetM,maximumOffsetM,
});
function fixture(index=0,lateral=0,vertical=0){
  const r=measuredFixture(index);
  return {...r,source:{...r.source,repertoireVersion:version,
    centerOfMass:{...r.source.centerOfMass,x:r.source.handedness==='R'?-.72:.72},
    sampledProfiles:r.source.sampledProfiles!.map(p=>({...p,contactAimV138:aim(lateral,vertical)}))}};
}
const ready=(r:ReturnType<typeof fixture>)=>{
  const v=prepareBattingExecution(r);expect(v.ok).toBe(true);
  if(!v.ok)throw Error('explicit prospective contact aim must be accepted');
  const motion=v.value.commitment!.sampledTrajectoryV1!;expect(motion).toBeDefined();return motion;
};

it.each([0,6])('registers a prospective signed field aim once while retaining the original measured curve and delivered forecast (%i)',index=>{
  const zero=fixture(index),input=fixture(index,.006,-.008),before=JSON.stringify(input),base=ready(zero),m=ready(input);
  expect(m.frames).toEqual(base.frames);expect(m.provenance).toEqual(base.provenance);
  expect(m.transform.rotation).toEqual(base.transform.rotation);expect(m.startTick).toBe(base.startTick);
  expect(m.playbackRate).toBe(base.playbackRate);expect(m.batLengthM).toBe(base.batLengthM);
  const a=createReferenceBatKinematicsV1(base),b=createReferenceBatKinematicsV1(m);
  for(const phase of [0,.25,.5,.75,1]){
    const t=m.startTick+phase*(m.frames.at(-1)!.tick-m.frames[0].tick)/m.sourceTicksPerSecond*m.ticksPerSecond;
    const x=a.sampleContinuous(t),y=b.sampleContinuous(t);
    expect(y.sweetSpot.x-x.sweetSpot.x).toBeCloseTo(.006,12);
    expect(y.sweetSpot.y-x.sweetSpot.y).toBeCloseTo(-.008,12);
    expect(y.sweetSpot.z).toBe(x.sweetSpot.z);
    expect(y.sweetSpotVelocity).toEqual(x.sweetSpotVelocity);
    expect(y.orientation).toEqual(x.orientation);
  }
  expect(b.maximumSweetSpotSpeedMps).toBe(a.maximumSweetSpotSpeedMps);
  expect(JSON.stringify(input)).toBe(before);
  expect(input.source.sampledProfiles![0].measured).toEqual(zero.source.sampledProfiles![0].measured);
  expect(input.source.predictions).toEqual(zero.source.predictions);
  expect(m).not.toHaveProperty('exitSpin');expect(m).not.toHaveProperty('aimCorrectionV121');
});

it('keeps zero aim identical to the complete old V137 motor and uses field signs rather than a hidden handedness mirror',()=>{
  for(const index of [0,6]){
    const input=fixture(index),{contactAimV138:_,...profile}=input.source.sampledProfiles[0];
    const previous={...input,source:{...input.source,repertoireVersion:'measured_bat_field_upright_repertoire_v137',sampledProfiles:[profile]}};
    const old=prepareBattingExecution(previous);expect(old.ok).toBe(true);
    if(!old.ok)throw Error('old field motor required');
    expect(ready(input)).toEqual(old.value.commitment!.sampledTrajectoryV1);
    const plus=ready(fixture(index,.004,.003)),minus=ready(fixture(index,-.004,-.003));
    expect(plus.transform.translation.x-minus.transform.translation.x).toBeCloseTo(.008,12);
    expect(plus.transform.translation.y-minus.transform.translation.y).toBeCloseTo(.006,12);
  }
});

it('rejects missing, malformed, nonfinite or outside-assessment aim instead of clipping it or changing a ball forecast',()=>{
  const mutations=[
    (p:any)=>{delete p.contactAimV138;},
    (p:any)=>{p.contactAimV138.version='unknown';},
    (p:any)=>{p.contactAimV138.lateralOffsetM=NaN;},
    (p:any)=>{p.contactAimV138.verticalOffsetM=Infinity;},
    (p:any)=>{p.contactAimV138.maximumOffsetM=0;},
    (p:any)=>{p.contactAimV138.maximumOffsetM=-.02;},
    (p:any)=>{p.contactAimV138.maximumOffsetM=Infinity;},
    (p:any)=>{p.contactAimV138.maximumOffsetM=p.measured.batLengthM+.001;},
    (p:any)=>{p.contactAimV138.lateralOffsetM=.015;p.contactAimV138.verticalOffsetM=.015;},
    (p:any)=>{p.contactAimV138.exitSpin={x:1,y:0,z:0};},
    (p:any)=>{p.measured.contactAimV138=p.contactAimV138;},
  ];
  for(const mutate of mutations){const input=fixture();mutate(input.source.sampledProfiles[0]);expect(prepareBattingExecution(input).ok).toBe(false);}
  expect(prepareBattingExecution(fixture(0,.012,.016)).ok).toBe(true);
});

it.each(['measured_bat_axis_repertoire_v1','measured_bat_axis_upright_repertoire_v2','measured_bat_field_upright_repertoire_v137'])(
  'does not silently reinterpret an older model as a contact-aim model (%s)',repertoireVersion=>{
    const input=fixture();expect(prepareBattingExecution({...input,source:{...input.source,repertoireVersion}}).ok).toBe(false);
  });
