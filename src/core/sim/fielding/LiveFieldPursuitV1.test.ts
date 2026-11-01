import {expect,it} from 'vitest';
import {evaluateLiveFieldDecisionV1,type LiveFieldDecisionContextV1} from './LiveFieldDecisionV1';
const v=(x=0,y=0,z=0)=>({x,y,z});
const actor=(playerId:string,z:number)=>({playerId,position:v(0,1,z),velocity:v(),homePosition:v(0,1,z),topSpeedMps:7,accelerationMps2:10,throwSpeedMps:30,remainingReactionSeconds:0});
const context=()=>{
 const self=actor('rear',42),peer=actor('front',40),bases={1:v(19.39,0,19.39),2:v(0,0,38.78),3:v(-19.39,0,19.39),4:v()};
 return {elapsedSeconds:1,observationSeconds:.8,self,others:[peer],bases,ball:v(0,.4,38),ballVelocity:v(0,0,8),possessionPlayerId:null,
  pickup:{point:v(0,.4,40),eta:.25,intercepted:false},threats:[{base:2 as const,arrivalSeconds:2}],
  received:[{sourceId:'front',role:{playerId:'front',taskId:'pickup',point:v(0,.4,40),intent:'intercept' as const,targetBase:null},trust:.8}],
  pickupWindowsV120:[{family:'direct' as const,point:v(0,.4,40),eta:.25,arrivalSeconds:.8,intercepted:false,latenessSeconds:.55},
   {family:'following' as const,point:v(0,.4,43.5),eta:.9,arrivalSeconds:.7,intercepted:true},
   {family:'recovery' as const,point:v(0,.2,46),eta:1.6,arrivalSeconds:1.3,intercepted:true}]} satisfies LiveFieldDecisionContextV1&{pickupWindowsV120:readonly unknown[]};
};
it('keeps a distinct following interception after a teammate claim instead of automatically covering',()=>{
 const result=evaluateLiveFieldDecisionV1(context());
 expect(result.role.taskId).toBe('pickup:following');
 expect(result.candidates.some(c=>c.role.taskId==='pickup')).toBe(true);
 expect(result.candidates.some(c=>c.role.taskId==='cover:2')).toBe(true);
});
it('can keep a far player in support without imposing a pursuit head count',()=>{
 const input=context(),far={...input,self:actor('rear',90),pickupWindowsV120:input.pickupWindowsV120.map(w=>({...w,arrivalSeconds:9}))};
 expect(evaluateLiveFieldDecisionV1(far).role.intent).not.toBe('intercept');
});
it('does not treat a nearby teammate claim as certainty of a future catch',()=>{
 const input=context(),result=evaluateLiveFieldDecisionV1(input);
 const choices=result.candidates.filter(c=>c.role.intent==='intercept');
 expect(choices.length).toBeGreaterThan(1);
 expect(choices.every(c=>Number.isFinite(c.cost))).toBe(true);
});
