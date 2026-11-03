import {expect,it} from 'vitest';
import {createReferenceBatKinematicsV1} from './ReferenceBatKinematicsV1';
import {quaternionFromAxisAngle} from '../pitching/BaseballOrientation';
import {registerMeasuredBatToFieldV1,registerMeasuredPositionToFieldV137,registerMeasuredAxialToFieldV137,
  registerMeasuredOrientationToFieldV137,MEASURED_BAT_FIELD_REGISTRATION_V1} from './MeasuredFieldRegistrationV137';
import {registerMeasuredBatToFieldV1 as browserRegistration} from '../../../integration/browser/MeasuredBatFieldRegistrationV1';

it('registers both measured sides into the same field basis and preserves the Browser contract',()=>{
  const frames=[{tick:0,grip:{x:.6,y:1,z:.2},orientation:quaternionFromAxisAngle({x:1,y:2,z:3},.5)},
    {tick:100000,grip:{x:-.6,y:1.2,z:.3},orientation:quaternionFromAxisAngle({x:3,y:2,z:1},1.3)}],before=JSON.stringify(frames),out=registerMeasuredBatToFieldV1(frames);
  expect(out[0].grip).toEqual({x:-.6,y:1,z:.2});expect(out[1].grip).toEqual({x:.6,y:1.2,z:.3});
  expect(out[0].orientation).toEqual({w:frames[0].orientation.w,x:frames[0].orientation.x,y:-frames[0].orientation.y,z:-frames[0].orientation.z});
  expect(browserRegistration).toBe(registerMeasuredBatToFieldV1);expect(JSON.stringify(frames)).toBe(before);
  expect(MEASURED_BAT_FIELD_REGISTRATION_V1.rightHandedBox).toBe('THIRD_BASE_NEGATIVE_X');
  expect(registerMeasuredPositionToFieldV137({x:.56,y:.8,z:0})).toEqual({x:-.56,y:.8,z:0});
});

it('reflects actual tip/linear velocity as polar vectors and angular velocity as an axial vector',()=>{
  const frames=[{tick:0,grip:{x:.6,y:1,z:.2},orientation:quaternionFromAxisAngle({x:1,y:2,z:3},.5)},
    {tick:100000,grip:{x:.3,y:1.2,z:.3},orientation:quaternionFromAxisAngle({x:3,y:2,z:1},1.3)}],
    input={provenance:{clipId:'explicit-basis-test',sourceSha256:'1'.repeat(64)},frames,batLengthM:.84,sweetSpotT:.8,
      sourceTicksPerSecond:1e6,startTick:1e6,ticksPerSecond:1e6,playbackRate:1,transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1}},
    raw=createReferenceBatKinematicsV1(input).sampleContinuous(1050000),field=createReferenceBatKinematicsV1({...input,frames:registerMeasuredBatToFieldV1(frames)}).sampleContinuous(1050000),
    pairs=[[field.state.pose.tip,registerMeasuredPositionToFieldV137(raw.state.pose.tip)],
      [field.state.linearVelocity,registerMeasuredPositionToFieldV137(raw.state.linearVelocity)],
      [field.sweetSpotVelocity,registerMeasuredPositionToFieldV137(raw.sweetSpotVelocity)],
      [field.state.angularVelocity,registerMeasuredAxialToFieldV137(raw.state.angularVelocity)]] as const;
  for(const [actual,expected]of pairs)for(const axis of ['x','y','z']as const)expect(Math.abs(actual[axis]-expected[axis])).toBeLessThan(1e-11);
  expect(registerMeasuredOrientationToFieldV137(frames[0].orientation)).toEqual(registerMeasuredBatToFieldV1(frames)[0].orientation);
});
