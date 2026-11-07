import {expect,it} from 'vitest';
import {evaluateLiveFieldDecisionV1,type LiveFieldDecisionContextV1} from './LiveFieldDecisionV1';
import {LIVE_FIELD_PITCHER_COVERS_FIRST_POLICY_V1,validateLiveFieldPitcherCoversFirstPolicyV1} from './LiveFieldRangeV1';
const v=(x=0,y=1,z=0)=>({x,y,z});
const actor=(id:string,x:number,z:number,position:'P'|'1B'|'2B')=>({playerId:id,position:v(x,1,z),velocity:v(0,0,0),homePosition:v(x,1,z),
  topSpeedMps:7,accelerationMps2:6,throwSpeedMps:32,remainingReactionSeconds:0,defensivePosition:position});
// A grounder between first and second; the second baseman has it and the first baseman is going for it too, nearer the bag than
// the pitcher. The batter is on his way to first.
const context=(extra:Partial<LiveFieldDecisionContextV1>={}):LiveFieldDecisionContextV1=>({elapsedSeconds:.6,observationSeconds:.5,
  self:actor('p',0,18.44,'P'),others:[actor('1b',19.9,30.6,'1B'),actor('2b',9.6,44,'2B')],
  bases:{1:v(19.39,0,19.39),2:v(0,0,38.78),3:v(-19.39,0,19.39),4:v(0,0,0)},
  ball:v(9,.04,22),ballVelocity:v(10,0,18),possessionPlayerId:null,pickup:{point:v(16,.04,36),eta:1.4,intercepted:true},
  threats:[{base:1,arrivalSeconds:4.1}] as any,received:[],coverAllowedV1:()=>false,...extra});

it('sends the pitcher to first at once on a ground ball to the right side',()=>{
  const d=evaluateLiveFieldDecisionV1(context({pitcherCoversFirstV1:true}));
  expect(d.role).toMatchObject({intent:'base_cover',targetBase:1});
});

it('leaves the pitcher waiting for the cover plan without it',()=>{
  expect(evaluateLiveFieldDecisionV1(context()).role.intent).not.toBe('base_cover');
});

it('changes only the pitcher',()=>{
  const first=evaluateLiveFieldDecisionV1({...context({pitcherCoversFirstV1:true}),self:actor('1b',19.9,30.6,'1B'),others:[actor('p',0,18.44,'P'),actor('2b',9.6,44,'2B')]});
  const plain=evaluateLiveFieldDecisionV1({...context(),self:actor('1b',19.9,30.6,'1B'),others:[actor('p',0,18.44,'P'),actor('2b',9.6,44,'2B')]});
  expect(first.role).toEqual(plain.role);
  expect(validateLiveFieldPitcherCoversFirstPolicyV1(LIVE_FIELD_PITCHER_COVERS_FIRST_POLICY_V1)).toBe(LIVE_FIELD_PITCHER_COVERS_FIRST_POLICY_V1);
});
