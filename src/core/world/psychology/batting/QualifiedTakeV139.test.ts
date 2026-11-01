import {expect,it} from 'vitest';
import {measuredFixture} from './MeasuredBattingFixtures.test-support';
import {value} from './BattingFixtures.test-support';
import {calculateBattingSpinExecutionV123} from './BattingCommitment';

/** Semantic regression of the observed IQP138 case, not copied Native proof:
 * a learned technique never forces SWING against the observer's TAKE decision. */
it('retains AUTO TAKE from delivered zero swing scores even with an explicitly qualified spin intent',()=>{
  const r=measuredFixture(),s=r.source,ref={sourceId:'synthetic-repertoire',sourceVersion:'v139'},
    repertoire={repertoireId:s.repertoireId,repertoireVersion:'measured_bat_field_contact_aim_repertoire_v138',profiles:s.profiles,
      sampledProfiles:s.sampledProfiles!.map(p=>({...p,contactAimV138:{version:'measured_bat_contact_aim_v138',
        lateralOffsetM:0,verticalOffsetM:-.01,maximumOffsetM:.02}}))};
  const input={nominalRequest:{...r,source:{...s,...repertoire,directive:'AUTO',predictions:s.predictions.map(p=>({...p,swingScore:0}))}},
    effectiveValues:{decision:{...s.decisionModel,threshold:.5},motor:{motorLatencyTicks:s.motorLatencyTicks,
      technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},repertoire},
    spinContext:{atDay:10,repertoireSourceRef:ref,intent:{technique:'BACKSPIN',selectedAtTick:r.currentFrame.time.tick},techniques:[{
      technique:'BACKSPIN',qualificationRef:{sourceId:'synthetic-semantic-qualification',sourceVersion:'v139'},acceptedAtDay:9,repertoireRef:ref,
      calibration:{sourceId:'synthetic-calibration',sourceVersion:'v139',status:'MODEL_VERIFIED'},
      motorProfileRefs:[{profileId:s.profiles[0].profile.profileId,version:s.profiles[0].profile.version,
        implementationV133:'registered_measured_contact_aim_v138'}]}]}};
  const before=JSON.stringify(input),out=value(calculateBattingSpinExecutionV123(input));
  expect(out.status).toBe('READY');expect(out.commitment).toMatchObject({action:'TAKE',trajectory:null});
  expect(out.commitment).not.toHaveProperty('sampledTrajectoryV1');expect(out.spinMotorPlanV123).toBeNull();
  expect(JSON.stringify(input)).toBe(before);
});
