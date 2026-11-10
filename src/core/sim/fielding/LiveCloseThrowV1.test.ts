import {describe,expect,it} from 'vitest';
import {decideLiveCloseThrowV1,LIVE_CLOSE_THROW_CALIBRATION_V1,liveCloseThrowSkillV1,liveCloseThrowToleranceV1,validateLiveFieldThrowPolicyV1,LIVE_FIELD_THROW_POLICY_V1} from './LiveCloseThrowV1';

const throws=(marginSeconds:number,decisionSeconds:number,extra={})=>{
  let n=0;for(let i=0;i<400;i++)if(decideLiveCloseThrowV1({seed:7,opportunityId:'o'+i,marginSeconds,decisionSeconds,pursuitCostWeight:1,...extra}).attempt)n++;
  return n/400;
};
describe('close throw judgment',()=>{
  it('nobody throws past the hopeless line',()=>{
    for(const d of [.035,.1,.3])expect(throws(-LIVE_CLOSE_THROW_CALIBRATION_V1.hopelessSeconds-.01,d)).toBe(0);
  });
  it('a close race is thrown by everyone',()=>{
    for(const d of [.035,.1,.3])expect(throws(-.1,d)).toBe(1);
  });
  it('giving up is the skilled choice',()=>{
    expect(throws(-.5,.3)).toBe(1);
    expect(throws(-.5,.035)).toBe(0);
    expect(liveCloseThrowToleranceV1({decisionSeconds:.035,pursuitCostWeight:1})).toBeLessThan(liveCloseThrowToleranceV1({decisionSeconds:.3,pursuitCostWeight:1}));
  });
  it('an unauthored decision time is neutral, not the best',()=>{
    expect(liveCloseThrowSkillV1(0)).toBe(.5);
  });
  it('caution and pursuit weight come through resolved values',()=>{
    const plain=liveCloseThrowToleranceV1({decisionSeconds:.1,pursuitCostWeight:1});
    expect(liveCloseThrowToleranceV1({decisionSeconds:.1,pursuitCostWeight:1,cautious:true})).toBeLessThan(plain);
    expect(liveCloseThrowToleranceV1({decisionSeconds:.1,pursuitCostWeight:.5})).toBeGreaterThan(plain);
    expect(liveCloseThrowToleranceV1({decisionSeconds:.3,pursuitCostWeight:.25})).toBe(LIVE_CLOSE_THROW_CALIBRATION_V1.hopelessSeconds);
  });
  it('the same opportunity keeps its draw',()=>{
    const input={seed:9,opportunityId:'same',marginSeconds:-.3,decisionSeconds:.1,pursuitCostWeight:1};
    expect(decideLiveCloseThrowV1(input)).toEqual(decideLiveCloseThrowV1(input));
  });
  it('rejects a malformed policy',()=>{
    expect(validateLiveFieldThrowPolicyV1(LIVE_FIELD_THROW_POLICY_V1)).toBe(LIVE_FIELD_THROW_POLICY_V1);
    expect(()=>validateLiveFieldThrowPolicyV1({version:'x',sourceId:'y'} as never)).toThrow();
  });
  it('accepts runnerContinuesV1 only as true',()=>{
    const on={...LIVE_FIELD_THROW_POLICY_V1,runnerContinuesV1:true as const};
    expect(validateLiveFieldThrowPolicyV1(on)).toBe(on);
    expect(()=>validateLiveFieldThrowPolicyV1({...LIVE_FIELD_THROW_POLICY_V1,runnerContinuesV1:false} as never)).toThrow();
    expect(()=>validateLiveFieldThrowPolicyV1({...LIVE_FIELD_THROW_POLICY_V1,other:true} as never)).toThrow();
  });
  it('accepts holderTagCrouchV1 only as true, alone or with runnerContinuesV1',()=>{
    const both={...LIVE_FIELD_THROW_POLICY_V1,runnerContinuesV1:true as const,holderTagCrouchV1:true as const};
    expect(validateLiveFieldThrowPolicyV1(both)).toBe(both);
    expect(validateLiveFieldThrowPolicyV1({...LIVE_FIELD_THROW_POLICY_V1,holderTagCrouchV1:true})).toEqual({...LIVE_FIELD_THROW_POLICY_V1,holderTagCrouchV1:true});
    expect(()=>validateLiveFieldThrowPolicyV1({...LIVE_FIELD_THROW_POLICY_V1,holderTagCrouchV1:false} as never)).toThrow();
  });
});
