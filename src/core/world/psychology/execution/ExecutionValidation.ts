import { compareTime, fail, fraction, integer, obj, readScope, readTime, same, text } from '../EmotionValidation';
import type { DecisionTimingWindow, EmotionFreeDecisionBaseline, ExecutionFrame, ExecutionModel } from './ExecutionTypes';
/** Clone inert data only; never evaluate getters/toJSON and never return aliases into caller data. */
export function cloneExecutionData(input: unknown, path = 'data'): unknown {
 const ancestors = new Set<object>(); let nodes = 0;
 function visit(value: unknown, p: string, depth: number): unknown {
  if (++nodes > 100000 || depth > 64) fail('INVALID_INPUT',p+'.depthOrSize');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('INVALID_INPUT',p); return value === 0 ? 0 : value; }
  if (typeof value !== 'object') fail('INVALID_INPUT',p);
  if (ancestors.has(value)) fail('INVALID_INPUT',p+'.cycle');
  ancestors.add(value);
  let out: unknown;
  if (Array.isArray(value)) {
   if (Reflect.ownKeys(value).length !== value.length+1) fail('INVALID_INPUT',p);
   const arr: unknown[]=[];
   for(let i=0;i<value.length;i++){
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if(!d || !('value' in d) || !d.enumerable) fail('INVALID_INPUT',p);
    arr.push(visit(d.value,p+'['+i+']',depth+1));
   }
   out=arr;
  } else {
   const keys=Reflect.ownKeys(value);
   if(keys.some(k=>typeof k!=='string'))fail('INVALID_INPUT',p);
   const record=obj(value,keys as string[],p),copy:Record<string,unknown>={};
   for(const k of keys as string[])Object.defineProperty(copy,k,{value:visit(record[k],p+'.'+k,depth+1),enumerable:true,writable:true,configurable:true});
   out=copy;
  }
  ancestors.delete(value);return out;
 }
 return visit(input,path,0);
}
export function readFrame(input: unknown,path: string): ExecutionFrame {
 const v=obj(input,['scope','contextId','snapshotId','worldRevision','time'],path);
 return {scope:readScope(v.scope,path+'.scope'),contextId:text(v.contextId,path+'.contextId'),snapshotId:text(v.snapshotId,path+'.snapshotId'),
  worldRevision:integer(v.worldRevision,path+'.worldRevision'),time:readTime(v.time,path+'.time')};
}
function readWindow(input:unknown,path:string,frame:ExecutionFrame):DecisionTimingWindow {
 const v=obj(input,['tick','earliestTick','latestTick'],path);
 const tick=integer(v.tick,path+'.tick'),earliestTick=integer(v.earliestTick,path+'.earliestTick'),latestTick=integer(v.latestTick,path+'.latestTick');
 if(earliestTick>tick || latestTick<tick || tick<frame.time.tick)fail('INVALID_INPUT',path+'.window');
 return {tick,earliestTick,latestTick};
}
export function readBaseline(input:unknown,frame:ExecutionFrame):EmotionFreeDecisionBaseline {
 const p='request.baseline',v=obj(input,['basis','sourceId','revision','frame','swingDecision','throwIntent','defenseReplan',
  'swingAggression','throwAggression','minimumAdvanceSafetyMarginTicks'],p);
 if(v.basis!=='WITHOUT_EMOTION')fail('INVALID_INPUT',p+'.basis');
 const sourceFrame=readFrame(v.frame,p+'.frame');
 if(!same(sourceFrame,frame))fail('INCONSISTENT_STATE',p+'.frame');
 return {basis:'WITHOUT_EMOTION',sourceId:text(v.sourceId,p+'.sourceId'),revision:integer(v.revision,p+'.revision'),frame:sourceFrame,
  swingDecision:readWindow(v.swingDecision,p+'.swingDecision',frame),throwIntent:readWindow(v.throwIntent,p+'.throwIntent',frame),
  defenseReplan:readWindow(v.defenseReplan,p+'.defenseReplan',frame),swingAggression:fraction(v.swingAggression,p+'.swingAggression'),
  throwAggression:fraction(v.throwAggression,p+'.throwAggression'),minimumAdvanceSafetyMarginTicks:integer(v.minimumAdvanceSafetyMarginTicks,p+'.minimumAdvanceSafetyMarginTicks')};
}
export function readModel(input:unknown):ExecutionModel {
 const p='request.model',v=obj(input,['modelId','version','runningRiskTicksPerUnit','maximumAdvanceSafetyMarginTicks'],p);
 return {modelId:text(v.modelId,p+'.modelId'),version:text(v.version,p+'.version'),runningRiskTicksPerUnit:integer(v.runningRiskTicksPerUnit,p+'.runningRiskTicksPerUnit'),
  maximumAdvanceSafetyMarginTicks:integer(v.maximumAdvanceSafetyMarginTicks,p+'.maximumAdvanceSafetyMarginTicks')};
}
export function bindFrame(scope:unknown,contextId:string,time:ExecutionFrame['time'],frame:ExecutionFrame):void {
 if(!same(scope,frame.scope))fail('SCOPE_MISMATCH','request.frame.scope');
 if(contextId!==frame.contextId || compareTime(time,frame.time)!==0)fail('INCONSISTENT_STATE','request.frame.contextOrTime');
}
export function safeTickSum(a:number,b:number,path:string):number {
 const sum=a+b;if(!Number.isSafeInteger(sum))fail('INVALID_INPUT',path+'.overflow');return sum===0?0:sum;
}
