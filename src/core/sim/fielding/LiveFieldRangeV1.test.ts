import {describe,expect,it} from 'vitest';
import {LIVE_RUNNER_THROW_READ_POLICY_V1,validateLiveRunnerThrowReadPolicyV1} from './LiveFieldRangeV1';
import {LIVE_FIELD_RANGE_CALIBRATION_V1,LIVE_FIELD_RANGE_PLACEMENTS_V1,LIVE_FIELD_RANGE_POLICY_V1,liveFieldCoverOrderV1,liveFieldCrouchDueV1,liveFieldLowGloveTargetV1,liveFieldPlacementV1,liveFieldRangeSpecV1,validateLiveFieldRangePolicyV1} from './LiveFieldRangeV1';
import {liveFieldArrivalSecondsV1} from './LiveFieldRoleAssignmentV1';
import {resolveLiveFielderBodyModelV105,validateLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';

const body=resolveLiveFielderBodyModelV105(1.82,1.35),spec=(defensivePosition:string)=>({accelerationMps2:5.4,defensivePosition,bodyModelV105:body});
const split=(accelerationMps2:number)=>liveFieldArrivalSecondsV1({playerId:'x',position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},homePosition:{x:0,y:0,z:0},
  topSpeedMps:8.1,accelerationMps2,throwSpeedMps:30,remainingReactionSeconds:0},{x:9.144,y:0,z:0},0);
const angle=(p:{x:number;z:number})=>Math.atan2(p.x,p.z)*180/Math.PI;

describe('field range policy',()=>{
  it('rejects a malformed policy',()=>{
    expect(validateLiveFieldRangePolicyV1(LIVE_FIELD_RANGE_POLICY_V1)).toBe(LIVE_FIELD_RANGE_POLICY_V1);
    expect(()=>validateLiveFieldRangePolicyV1({version:'x',sourceId:'y'} as never)).toThrow();
  });
  it('gives every infielder the same ready start, so no position or player is favoured',()=>{
    const scaled=['P','C','1B','2B','3B','SS'].map(p=>liveFieldRangeSpecV1(spec(p)).accelerationMps2);
    expect(new Set(scaled).size).toBe(1);
    expect(scaled[0]).toBeCloseTo(5.4*LIVE_FIELD_RANGE_CALIBRATION_V1.readyAccelerationScale);
    expect(liveFieldRangeSpecV1(spec('CF')).accelerationMps2).toBeCloseTo(5.4*LIVE_FIELD_RANGE_CALIBRATION_V1.readOutfieldAccelerationScale);
  });
  it('a ready start covers ten yards in a usual big-league split',()=>{
    const ready=split(5.4*LIVE_FIELD_RANGE_CALIBRATION_V1.readyAccelerationScale);
    expect(split(5.4)).toBeGreaterThan(2);
    expect(ready).toBeGreaterThan(1.55);expect(ready).toBeLessThan(1.8);
  });
  it('keeps a valid body and a low hand that reaches further from the deepest crouch',()=>{
    const m=liveFieldRangeSpecV1(spec('SS')).bodyModelV105;
    expect(validateLiveFielderBodyModelV105(m)).toBe(true);
    const reach=(arm:number,crouch:number)=>Math.sqrt(arm**2-(body.shoulderHeightMeters-crouch-.04)**2);
    expect(reach(m.armReachMeters,m.maximumCrouchMeters)).toBeGreaterThan(.8);
    expect(reach(body.armReachMeters,body.maximumCrouchMeters)).toBeLessThan(.5);
  });
  it('stays up until the crouch is due, and later still when the ball is out of reach on foot',()=>{
    const m=liveFieldRangeSpecV1(spec('SS')).bodyModelV105,full=m.maximumCrouchMeters/m.postureSpeedMps;
    expect(liveFieldCrouchDueV1(m,full,true)).toBe(true);
    expect(liveFieldCrouchDueV1(m,full+.5,true)).toBe(false);
    expect(liveFieldCrouchDueV1(m,full,false)).toBe(false);
    expect(liveFieldCrouchDueV1(m,.1,false)).toBe(true);
  });
  it('puts the glove at ball height before reaching out',()=>{
    const shoulder={x:0,y:.7,z:0},far={x:5,y:.04,z:0},low=liveFieldLowGloveTargetV1(1,shoulder,far);
    expect(low.y).toBe(.04);expect(Math.hypot(low.x,low.y-.7,low.z)).toBeLessThanOrEqual(1);expect(low.x).toBeGreaterThan(.7);
    const near={x:.2,y:.04,z:0};expect(liveFieldLowGloveTargetV1(1,shoulder,near)).toEqual(near);
    const high={x:1,y:2,z:0};expect(liveFieldLowGloveTargetV1(1,shoulder,high)).toBe(high);
    const below={x:1,y:-.9,z:0};expect(liveFieldLowGloveTargetV1(1,shoulder,below)).toBe(below);
  });
  it('spaces the infield off the lines with no gap wider than the usual alignment',()=>{
    const p=LIVE_FIELD_RANGE_PLACEMENTS_V1,a={third:angle(p['3B']),ss:angle(p.SS),second:angle(p['2B']),first:angle(p['1B'])};
    expect(a.third).toBeGreaterThan(-36);expect(a.first).toBeLessThan(36);
    expect(a.ss-a.third).toBeLessThan(21);expect(a.second-a.ss).toBeLessThan(30);expect(a.first-a.second).toBeLessThan(21);
    expect(Math.hypot(p.SS.x,p.SS.z)).toBeGreaterThan(Math.hypot(0,38.79));
  });
  it('gives each bag one first choice, and second to the middle infielder away from the ball',()=>{
    expect(liveFieldCoverOrderV1(2,-10)[0]).toBe('2B');
    expect(liveFieldCoverOrderV1(2,10)[0]).toBe('SS');
    expect(liveFieldCoverOrderV1(1,0)).toEqual(['1B','P','2B']);
    expect(liveFieldCoverOrderV1(4,0)[0]).toBe('C');
  });
  it('moves only the infield corners and middle',()=>{
    const pitcher={x:0,y:.9,z:18.44};expect(liveFieldPlacementV1('P',pitcher)).toBe(pitcher);
    expect(liveFieldPlacementV1('SS',{x:-13,y:.9,z:36})).toEqual({...LIVE_FIELD_RANGE_PLACEMENTS_V1.SS,y:.9});
  });
});
describe('runner throw read policy',()=>{
  it('takes a read error spread from 0 to 2 seconds and nothing else new',()=>{
    const base=LIVE_RUNNER_THROW_READ_POLICY_V1;
    expect(validateLiveRunnerThrowReadPolicyV1({...base,readErrorSeconds:.4})).toEqual({...base,readErrorSeconds:.4});
    for(const bad of [-.1,2.5,Number.NaN])expect(()=>validateLiveRunnerThrowReadPolicyV1({...base,readErrorSeconds:bad})).toThrow();
    expect(()=>validateLiveRunnerThrowReadPolicyV1({...base,other:1} as never)).toThrow();
  });
});
describe('field range policy diveAheadV1',()=>{
  it('accepts diveAheadV1 only as true',()=>{
    const on={...LIVE_FIELD_RANGE_POLICY_V1,diveAheadV1:true as const};
    expect(validateLiveFieldRangePolicyV1(on)).toBe(on);
    expect(validateLiveFieldRangePolicyV1(LIVE_FIELD_RANGE_POLICY_V1)).toBe(LIVE_FIELD_RANGE_POLICY_V1);
    for(const bad of [false,1,'true'])expect(()=>validateLiveFieldRangePolicyV1({...LIVE_FIELD_RANGE_POLICY_V1,diveAheadV1:bad} as never)).toThrow();
    expect(()=>validateLiveFieldRangePolicyV1({...LIVE_FIELD_RANGE_POLICY_V1,other:true} as never)).toThrow();
  });
});
