import {expect,it} from 'vitest';
import {LIVE_FIELD_PITCHER_FOLLOW_THROUGH_V1,liveFieldPitcherFollowThroughV1,validateLiveFieldPitcherFollowThroughPolicyV1,
  type LiveFieldPitcherFollowThroughPolicyV1} from './LiveFieldRangeV1';

const policy:LiveFieldPitcherFollowThroughPolicyV1={version:'live_field_pitcher_follow_through_policy_v1',sourceId:'test',recoverySeconds:.2};
const onRubber={position:{x:0,y:1.02,z:18.44},reactionSeconds:.18};

it('starts a right-hander in front of the rubber, fallen off toward first, and later',()=>{
  const p=liveFieldPitcherFollowThroughV1(onRubber,'R',policy);
  expect(p.position).toEqual({x:LIVE_FIELD_PITCHER_FOLLOW_THROUGH_V1.sideMeters,y:1.02,z:18.44-LIVE_FIELD_PITCHER_FOLLOW_THROUGH_V1.forwardMeters});
  expect(p.reactionSeconds).toBeCloseTo(.38,12);
});

it('turns the fall-off toward third for a left-hander',()=>{
  expect(liveFieldPitcherFollowThroughV1(onRubber,'L',policy).position.x).toBe(-LIVE_FIELD_PITCHER_FOLLOW_THROUGH_V1.sideMeters);
});

it('takes only a whole policy with a recovery from 0 to 1 s',()=>{
  expect(validateLiveFieldPitcherFollowThroughPolicyV1(policy)).toBe(policy);
  for(const bad of [{...policy,recoverySeconds:-.1},{...policy,recoverySeconds:1.5},{...policy,recoverySeconds:NaN},{...policy,extra:1}])
    expect(()=>validateLiveFieldPitcherFollowThroughPolicyV1(bad as any)).toThrow();
});
