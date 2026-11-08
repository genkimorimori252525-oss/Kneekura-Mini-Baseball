import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {measuredClips,measuredFixture} from './MeasuredBattingFixtures.test-support';
import {prepareBattingExecution} from './BattingCommitment';
import {createMeasuredBatAxisReferenceV1} from '../../../sim/contact/MeasuredBatAxisReferenceV1';
import {rotateVectorByQuaternion} from '../../../sim/pitching/BaseballOrientation';
import {registerMeasuredBatToFieldV1} from '../../../../integration/browser/MeasuredBatFieldRegistrationV1';

const version='measured_bat_field_upright_repertoire_v137';
for(const [index,clip]of measuredClips.entries())it(`accepts the explicit field basis and retains original ${clip.side} ${clip.id} keys and provenance`,()=>{
  const base=measuredFixture(index),r={...base,source:{...base.source,repertoireVersion:version,centerOfMass:{...base.source.centerOfMass,
    x:clip.side==='R'?-Math.abs(base.source.centerOfMass.x):Math.abs(base.source.centerOfMass.x)}}};
  const before=JSON.stringify(r),result=prepareBattingExecution(r);expect(result.ok).toBe(true);
  if(!result.ok)throw Error('field measured repertoire must be accepted');
  const planned=result.value.commitment!.sampledTrajectoryV1!,p=r.source.sampledProfiles![0],raw=createMeasuredBatAxisReferenceV1({...p.measured,
    startTick:0,ticksPerSecond:p.measured.sourceTicksPerSecond,playbackRate:1,
    transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1}}).reference;
  expect(planned.frames).toEqual(registerMeasuredBatToFieldV1(raw.frames));
  expect(planned.provenance).toEqual(raw.provenance);expect(planned.frames.map(f=>f.tick)).toEqual(raw.frames.map(f=>f.tick));
  const up=rotateVectorByQuaternion({x:0,y:1,z:0},planned.transform.rotation);
  expect(planned.transform.rotation.x).toBe(0);expect(planned.transform.rotation.z).toBe(0);
  expect(up.x).toBe(0);expect(up.z).toBe(0);expect(Math.abs(up.y-1)).toBeLessThan(1e-12);
  expect(JSON.stringify(r)).toBe(before);
});

it('preserves the pre-change full record hashes for both old registrations',()=>{
  const records=['measured_bat_axis_repertoire_v1','measured_bat_axis_upright_repertoire_v2'].map(repertoireVersion=>{
    const base=measuredFixture(),r={...base,source:{...base.source,repertoireVersion}};
    const result=prepareBattingExecution(r);expect(result.ok).toBe(true);
    return{repertoireVersion,sha256:createHash('sha256').update(JSON.stringify(result)).digest('hex')};
  });
  expect(records.map(r=>r.sha256)).toEqual(['6a4765785919b1dd5ebc5bed542c1cf18d46b17fe4b0e5d2a9aaa2dfb65c791c',
    '56b4f70b9ae63d328e5346b83d3706a1e04e32adc17563500c75610ee2c9bb5c']);
});
