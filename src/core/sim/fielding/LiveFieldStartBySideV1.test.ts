import {expect,it} from 'vitest';
import {LIVE_FIELD_START_BY_SIDE_POLICY_V1,LIVE_FIELD_START_BY_SIDE_V1,liveFieldRunnersV1,liveFieldStartBySideV1,validateLiveFieldStartBySidePolicyV1} from './LiveFieldRangeV1';

const degrees=(p:{x:number;z:number})=>Math.atan2(p.x,p.z)*180/Math.PI;

it('reads the runners as none, first base alone or any other',()=>{
  expect(liveFieldRunnersV1({first:null,second:null,third:null})).toBe('none');
  expect(liveFieldRunnersV1({first:'r1',second:null,third:null})).toBe('first');
  expect(liveFieldRunnersV1({first:'r1',second:'r2',third:null})).toBe('other');
  expect(liveFieldRunnersV1({first:null,second:null,third:'r3'})).toBe('other');
});

it('holds a runner on first at the bag and plays the first baseman by the batter with nobody on',()=>{
  const bag={x:19.39,z:19.39};
  for(const bats of ['L','R'] as const)
    expect(Math.hypot(LIVE_FIELD_START_BY_SIDE_V1[bats].first['1B'].x-bag.x,LIVE_FIELD_START_BY_SIDE_V1[bats].first['1B'].z-bag.z)).toBeLessThan(2.5);
  const left=LIVE_FIELD_START_BY_SIDE_V1.L.none['1B'],right=LIVE_FIELD_START_BY_SIDE_V1.R.none['1B'];
  expect(Math.hypot(left.x,left.z)).toBeGreaterThan(Math.hypot(right.x,right.z));
  expect(degrees(left)).toBeGreaterThan(degrees(right));
});

it('turns the middle infield toward each batter\'s pull side',()=>{
  expect(degrees(LIVE_FIELD_START_BY_SIDE_V1.L.none.SS)).toBeGreaterThan(degrees(LIVE_FIELD_START_BY_SIDE_V1.R.none.SS)+10);
  expect(degrees(LIVE_FIELD_START_BY_SIDE_V1.L.none['2B'])).toBeGreaterThan(degrees(LIVE_FIELD_START_BY_SIDE_V1.R.none['2B'])+10);
});

it('keeps the height and leaves a role it has no spot for where it was',()=>{
  expect(liveFieldStartBySideV1('CF',{x:0,y:.9,z:91},'R','none')).toEqual({x:2.7,y:.9,z:98.3});
  const pitcher={x:0,y:.9,z:18.44};
  expect(liveFieldStartBySideV1('P',pitcher,'L','first')).toBe(pitcher);
  expect(validateLiveFieldStartBySidePolicyV1(LIVE_FIELD_START_BY_SIDE_POLICY_V1)).toBe(LIVE_FIELD_START_BY_SIDE_POLICY_V1);
  expect(()=>validateLiveFieldStartBySidePolicyV1({...LIVE_FIELD_START_BY_SIDE_POLICY_V1,extra:1} as any)).toThrow();
});
