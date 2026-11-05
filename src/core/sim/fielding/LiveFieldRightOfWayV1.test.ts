import {expect,it} from 'vitest';
import {evaluateLiveFieldDecisionV1,type LiveFieldDecisionContextV1} from './LiveFieldDecisionV1';
import {MLB_INFIELD_DIRT_ARC_V1} from '../ball/BaseballSurfaceCalibrationV101';
const v=(x=0,y=1,z=0)=>({x,y,z});
type Position='SS'|'2B'|'CF'|'LF';
const actor=(id:string,x:number,z:number,position:Position)=>({playerId:id,position:v(x,1,z),velocity:v(0,0,0),homePosition:v(x,1,z),
  topSpeedMps:7,accelerationMps2:6,throwSpeedMps:32,remainingReactionSeconds:0,defensivePosition:position});
// A ground ball through the middle; the shortstop gets to where it stops before the centre fielder does.
const context=(stopZ:number):LiveFieldDecisionContextV1=>({elapsedSeconds:2,observationSeconds:1.8,self:actor('ss',-8,44,'SS'),
  others:[actor('cf',0,91,'CF')],bases:{1:v(19.39,0,19.39),2:v(0,0,38.78),3:v(-19.39,0,19.39),4:v(0,0,0)},
  ball:v(0,.04,stopZ-8),ballVelocity:v(0,0,6),possessionPlayerId:null,pickup:{point:v(0,.04,stopZ),eta:2.6,intercepted:true},
  threats:[],received:[],outfieldRightOfWayV1:MLB_INFIELD_DIRT_ARC_V1});
const call={sourceId:'cf',role:{playerId:'cf',taskId:'pickup',point:v(0,.04,58),intent:'intercept' as const,targetBase:null},trust:.8};

it('leaves a ball on the outfield grass to the outfielder who has called for it',()=>{
  expect(evaluateLiveFieldDecisionV1(context(58)).role.intent).toBe('intercept');
  expect(evaluateLiveFieldDecisionV1({...context(58),received:[call]}).role.intent).not.toBe('intercept');
});

it('keeps an infielder on a ball inside the dirt arc, and everyone on plain times without the input',()=>{
  expect(evaluateLiveFieldDecisionV1({...context(45),received:[call]}).role.intent).toBe('intercept');
  const {outfieldRightOfWayV1:_,...plain}={...context(58),received:[call]};
  expect(evaluateLiveFieldDecisionV1(plain).role.intent).toBe('intercept');
});

it('lets an outfielder go for a ball on the outfield grass that an infielder would reach first',()=>{
  const cf={...context(58),self:actor('cf',0,91,'CF'),others:[actor('ss',-8,44,'SS')],pickup:{point:v(0,.04,58),eta:2.6,intercepted:true}};
  expect(evaluateLiveFieldDecisionV1(cf).role.intent).toBe('intercept');
});
