import { fail, fraction, integer, list, obj, same, text } from '../EmotionValidation';
import { cloneExecutionData, readFrame } from './ExecutionValidation';
import type { EmotionFreeDecisionBaseline, EmotionRunnerSource, ExecutionFrame } from './ExecutionTypes';
const oneOf=(value:unknown,values:readonly unknown[],p:string):void=>{if(!values.includes(value))fail('INVALID_INPUT',p);};
/** Validates fields used by the existing decision owner; all other carried perception data must be inert. */
export function readRunnerSource(input:unknown,frame:ExecutionFrame,baseline:EmotionFreeDecisionBaseline):EmotionRunnerSource|null {
 if(input===null)return null;
 const p='request.runner',copy=cloneExecutionData(input,p),v=obj(copy,['sourceId','revision','frame','decision','body','parameters','endTick'],p);
 text(v.sourceId,p+'.sourceId');integer(v.revision,p+'.revision');
 if(!same(readFrame(v.frame,p+'.frame'),frame))fail('INCONSISTENT_STATE',p+'.frame');
 const d=obj(v.decision,['runnerId','perceivedWorld','perceivedCues','minimumCueConfidence','coachTrust','minimumAdvanceSafetyMarginTicks','decisionAbility','timingParameters'],p+'.decision');
 if(d.runnerId!==frame.scope.playerId)fail('SCOPE_MISMATCH',p+'.decision.runnerId');
 for(const k of ['minimumCueConfidence','coachTrust','decisionAbility'])fraction(d[k],p+'.decision.'+k);
 if(integer(d.minimumAdvanceSafetyMarginTicks,p+'.decision.minimumAdvanceSafetyMarginTicks')!==baseline.minimumAdvanceSafetyMarginTicks)
  fail('INCONSISTENT_STATE',p+'.decision.minimumAdvanceSafetyMarginTicks');
 const timing=obj(d.timingParameters,['minimumDecisionDelayTicks','maximumDecisionDelayTicks','fixedRecognitionOffsetTicks'],p+'.decision.timingParameters');
 for(const k of Object.keys(timing))integer(timing[k],p+'.decision.timingParameters.'+k);
 const w=obj(d.perceivedWorld,['observerId','observationTime','attention','ball','players','communications','knownContext'],p+'.world');
 if(w.observerId!==frame.scope.playerId)fail('SCOPE_MISMATCH',p+'.world.observerId');
 if(integer(w.observationTime,p+'.world.observationTime')!==frame.time.tick)fail('INCONSISTENT_STATE',p+'.world.observationTime');
 const context=obj(w.knownContext,['currentBase','nextBase','forcedToAdvance','tagUp'],p+'.world.knownContext');
 oneOf(context.currentBase,[1,2,3],p+'.currentBase');oneOf(context.nextBase,[2,3,4],p+'.nextBase');
 oneOf(context.forcedToAdvance,[true,false],p+'.forcedToAdvance');
 const tag=context.tagUp as Record<string,unknown>;
 // Access is safe: the entire source was cloned from inert descriptors above.
 if(!tag || typeof tag!=='object')fail('INVALID_INPUT',p+'.tagUp');
 oneOf(tag.kind,['none','must_retouch','awaiting_first_touch'],p+'.tagUp.kind');
 obj(tag,tag.kind==='must_retouch'?['kind','originBase']:['kind'],p+'.tagUp');
 const attention=obj(w.attention,['target','focusedSinceTick'],p+'.attention');
 const at=attention.target as Record<string,unknown>;
 if(!at || typeof at!=='object')fail('INVALID_INPUT',p+'.attention.target');
 oneOf(at.kind,['ball','base','player','coach'],p+'.attention.target.kind');
 const targetKey=at.kind==='base'?'base':at.kind==='player'?'playerId':at.kind==='coach'?'coachId':null;
 obj(at,targetKey===null?['kind']:['kind',targetKey],p+'.attention.target');
 if(at.kind==='base')oneOf(at.base,[1,2,3,4],p+'.attention.target.base');
 else if(targetKey!==null)text(at[targetKey],p+'.attention.target.'+targetKey);
 if(integer(attention.focusedSinceTick,p+'.attention.focusedSinceTick')>frame.time.tick)fail('INVALID_INPUT',p+'.attention');
 list(w.players,(player,pp)=>{const pl=obj(player,['playerId','memory'],pp);text(pl.playerId,pp+'.playerId');
  if(!pl.memory || typeof pl.memory!=='object' || (pl.memory as Record<string,unknown>).predictedAt!==frame.time.tick)fail('INVALID_INPUT',pp+'.memory');return player;},p+'.players');
 if(w.ball!==null && (!w.ball || typeof w.ball!=='object' || (w.ball as Record<string,unknown>).predictedAt!==frame.time.tick))fail('INVALID_INPUT',p+'.ball');
 list(w.communications,(item,pp)=>{
  const c=obj(item,['event','receivedAt','confidence'],pp),e=obj(c.event,['sourceId','targetScope','kind','issuedAt','content'],pp+'.event');
  text(e.sourceId,pp+'.sourceId');fraction(c.confidence,pp+'.confidence');oneOf(e.kind,['coach_signal','callout','warning'],pp+'.kind');
  const issued=integer(e.issuedAt,pp+'.issuedAt'),received=integer(c.receivedAt,pp+'.receivedAt');
  if(issued>received || received>frame.time.tick)fail('INVALID_INPUT',pp+'.chronology');
  const target=e.targetScope as Record<string,unknown>;if(!target || typeof target!=='object')fail('INVALID_INPUT',pp+'.targetScope');
  oneOf(target.kind,['player','team','nearby'],pp+'.targetScope.kind');
  obj(target,target.kind==='player'?['kind','playerId']:['kind'],pp+'.targetScope');
  if(target.kind==='player')text(target.playerId,pp+'.targetScope.playerId');
  return item;
 },p+'.communications');
 list(d.perceivedCues,(item,pp)=>{
  if(!item || typeof item!=='object')fail('INVALID_INPUT',pp);
  const kind=(item as Record<string,unknown>).kind;oneOf(kind,['next_base_race','current_base_threat'],pp+'.kind');
  const c=obj(item,kind==='next_base_race'?['kind','observedAt','confidence','runnerArrivalTick','defenderControlTick']:['kind','observedAt','confidence','runnerReturnTick','defenderTagTick'],pp);
  if(integer(c.observedAt,pp+'.observedAt')>frame.time.tick)fail('INVALID_INPUT',pp+'.observedAt');fraction(c.confidence,pp+'.confidence');
  for(const k of kind==='next_base_race'?['runnerArrivalTick','defenderControlTick']:['runnerReturnTick','defenderTagTick']){
   if(k==='defenderControlTick' && c[k]===null)continue;integer(c[k],pp+'.'+k);
  }
  return item;
 },p+'.perceivedCues');
 const b=obj(v.body,['tick','routeDistanceMeters','speedMps','driveDirection','bodyMode'],p+'.body');
 if(integer(b.tick,p+'.body.tick')!==frame.time.tick)fail('INCONSISTENT_STATE',p+'.body.tick');
 obj(v.parameters,['ticksPerSecond','reactionDelayTicks','accelerationMps2','brakingMps2','slideDecelerationMps2','topSpeedMps'],p+'.parameters');
 if(integer(v.endTick,p+'.endTick')<frame.time.tick)fail('INVALID_INPUT',p+'.endTick');
 // The existing Core owners validate physical ranges, timing ranges and matching bases next.
 return copy as EmotionRunnerSource;
}
