import {describe,it,expect} from 'vitest';
import {robustScenariosV247,evaluateRobustContactFrameAimV247} from './RobustContactFrameAimV247';

describe('declared finite scenarios',()=>{
 it('preserves axis means and variances, including zero sigma',()=>{
  const sigma={timingSeconds:.02,aim:{x:.01,y:.03,z:0}},s=robustScenariosV247(sigma);
  expect(s).toHaveLength(9);expect(s.reduce((a,b)=>a+b.weight,0)).toBeCloseTo(1,14);
  for(const [read,expected] of [[(v:typeof s[number])=>v.timingSeconds,sigma.timingSeconds],[(v:typeof s[number])=>v.aim.x,sigma.aim.x],[(v:typeof s[number])=>v.aim.y,sigma.aim.y],[(v:typeof s[number])=>v.aim.z,sigma.aim.z]] as const){expect(s.reduce((a,v)=>a+v.weight*read(v),0)).toBeCloseTo(0,14);expect(s.reduce((a,v)=>a+v.weight*read(v)**2,0)).toBeCloseTo(expected**2,14);}
 });
 it('shares each normal, keeps MISS in denominator and tie-breaks deterministically',()=>{
  const sigma={timingSeconds:1,aim:{x:1,y:1,z:1}},calls:number[]=[];
  const result=evaluateRobustContactFrameAimV247({sigma,candidates:[{ordinal:2,delta:{x:2,y:0,z:0},norm:2},{ordinal:1,delta:{x:1,y:0,z:0},norm:1}],thresholds:{minimumComponent:1,minimumImprovement:1},maximumEvaluations:27,evaluate:(s,d)=>{calls.push(s.ordinal);return d.x&&s.ordinal===1?{status:'MISS',reason:'NO_CONTACT'}:{status:'FOUND',component:d.x?2:0}}});
  expect(result.status).toBe('PLANNED');if(result.status==='PLANNED'){expect(result.selected.ordinal).toBe(1);expect(result.selected.scenarios).toHaveLength(9);expect(result.selected.successWeight).toBeCloseTo(11/12);}
  expect(calls).toHaveLength(27);
 });
 it('does not select from partial or unresolved evaluation',()=>{
  const sigma={timingSeconds:0,aim:{x:0,y:0,z:0}},candidate={ordinal:1,delta:{x:1,y:0,z:0},norm:1};let calls=0;
  const base={sigma,candidates:[candidate],thresholds:{minimumComponent:1,minimumImprovement:1},evaluate:()=>{calls++;return {status:'UNRESOLVED' as const,reason:'SEARCH'};}};
  expect(evaluateRobustContactFrameAimV247({...base,maximumEvaluations:17}).status).toBe('UNRESOLVED');expect(calls).toBe(0);
  expect(evaluateRobustContactFrameAimV247({...base,maximumEvaluations:18}).status).toBe('UNRESOLVED');expect(calls).toBe(18);
 });
 it('returns NO_TARGET for all misses and for no eligible candidates without evaluating',()=>{
  const sigma={timingSeconds:0,aim:{x:0,y:0,z:0}};let calls=0;
  const base={sigma,thresholds:{minimumComponent:1,minimumImprovement:1},evaluate:()=>{calls++;return {status:'MISS' as const,reason:'NO_CONTACT'};}};
  expect(evaluateRobustContactFrameAimV247({...base,candidates:[{ordinal:1,delta:{x:1,y:0,z:0},norm:1}],maximumEvaluations:18}).status).toBe('NO_TARGET');
  calls=0;expect(evaluateRobustContactFrameAimV247({...base,candidates:[],maximumEvaluations:0}).status).toBe('NO_TARGET');expect(calls).toBe(0);
 });
});
