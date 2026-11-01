import {expect,it} from 'vitest';
import {measuredFixture} from './MeasuredBattingFixtures.test-support';
import {value} from './BattingFixtures.test-support';
import {calculateObservedBattingMotorPlanV1,type BattingMotorPlanInputV1} from './BattingMotorPlanV1';
import {calculateObservedSpinMotorPlanV123,REGISTERED_MEASURED_LINEAR_V133} from './SpinMotorPlanV123';

const aimedFamily='registered_measured_contact_aim_v138';
function input(){
  const s=measuredFixture().source,p=s.predictions[1],profile=s.profiles[0],clip=s.sampledProfiles![0];
  const repertoire={repertoireId:s.repertoireId,repertoireVersion:'measured_bat_field_contact_aim_repertoire_v138',
    profiles:[profile,{minimumAggression:.1,profile:{...profile.profile,profileId:'ordinary'}}],
    sampledProfiles:[{...clip,contactAimV138:{version:'measured_bat_contact_aim_v138' as const,lateralOffsetM:0,verticalOffsetM:-.01,maximumOffsetM:.02}},
      {...clip,profileId:'ordinary',contactAimV138:{version:'measured_bat_contact_aim_v138' as const,lateralOffsetM:0,verticalOffsetM:0,maximumOffsetM:.02}}]};
  const base:BattingMotorPlanInputV1={decisionTick:1000,aggression:.8,repertoire,
    geometry:{handedness:s.handedness,centerOfMass:{...s.centerOfMass,x:-.72},batPhysical:s.batPhysical,plateZ:s.plateZ,strikeZone:s.strikeZone,
      bodyReadyTick:s.bodyReadyTick,latestMotorStartTick:s.latestMotorStartTick},
    motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},
    forecast:{observedTick:p.observedTick,availableTick:p.availableTick,validUntilTick:p.validUntilTick,trajectory:p.trajectory}};
  // Use the fixture's actual delivered observation clock, not a future sample.
  const observedBase={...base,decisionTick:Math.max(base.decisionTick,p.availableTick)};
  const repertoireSourceRef={sourceId:'prospective-aimed-repertoire',sourceVersion:'synthetic-v138'};
  return {base:observedBase,atDay:10,repertoireSourceRef,intent:{technique:'BACKSPIN',selectedAtTick:observedBase.decisionTick},
    techniques:[{technique:'BACKSPIN',qualificationRef:{sourceId:'synthetic-semantic-qualification',sourceVersion:'v138'},acceptedAtDay:9,
      repertoireRef:repertoireSourceRef,calibration:{sourceId:'synthetic-calibration',sourceVersion:'v138',status:'MODEL_VERIFIED'},
      motorProfileRefs:[{profileId:profile.profile.profileId,version:profile.profile.version,implementationV133:aimedFamily}]}]};
}

it('selects a specifically qualified prospective aimed motor while NO_SPIN_TARGET retains the ordinary zero-aim motor',()=>{
  const i=input(),before=JSON.stringify(i),result=value(calculateObservedSpinMotorPlanV123(i));
  expect(result.selectedIntent).toBe('BACKSPIN');expect(result.fallbackReason).toBeNull();
  expect(result.plan.status).toBe('READY');if(result.plan.status!=='READY')throw Error('aimed motor required');
  const ordinary=value(calculateObservedBattingMotorPlanV1(i.base));expect(ordinary.status).toBe('READY');
  if(ordinary.status!=='READY')throw Error('ordinary motor required');
  const a=result.plan.motion.sampledTrajectoryV1!,b=ordinary.motion.sampledTrajectoryV1!;
  expect(result.plan.motion.profileId).toBe('controlled');expect(ordinary.motion.profileId).toBe('ordinary');
  expect(a.transform.translation.y-b.transform.translation.y).toBeCloseTo(-.01,12);
  expect(a.frames).toEqual(b.frames);expect(a.transform.rotation).toEqual(b.transform.rotation);
  const normal=value(calculateObservedSpinMotorPlanV123({...i,intent:{...i.intent,technique:'NO_SPIN_TARGET'}}));
  expect(normal.plan).toEqual(ordinary);expect(result).not.toHaveProperty('exitSpin');expect(JSON.stringify(i)).toBe(before);
});

it('cannot transfer an old linear or ID-only qualification into the new aim implementation',()=>{
  for(const family of [REGISTERED_MEASURED_LINEAR_V133,undefined]){
    const i=input(),r=i.techniques[0].motorProfileRefs[0],{implementationV133:_,...identity}=r;
    const result=value(calculateObservedSpinMotorPlanV123({...i,techniques:[{...i.techniques[0],
      motorProfileRefs:[{...identity,...(family?{implementationV133:family}:{})}]}]}));
    expect(result.selectedIntent).toBe('NO_SPIN_TARGET');expect(result.fallbackReason).toBe('REPERTOIRE_UNAVAILABLE');
  }
});

it('does not let a new aim-family tag certify an old measured repertoire',()=>{
  const i=input(),base={...i.base,repertoire:{...i.base.repertoire,repertoireVersion:'measured_bat_field_upright_repertoire_v137',
    sampledProfiles:i.base.repertoire.sampledProfiles!.map(({contactAimV138:_,...p})=>p)}};
  const result=value(calculateObservedSpinMotorPlanV123({...i,base}));
  expect(result.selectedIntent).toBe('NO_SPIN_TARGET');expect(result.fallbackReason).toBe('REPERTOIRE_UNAVAILABLE');
});
