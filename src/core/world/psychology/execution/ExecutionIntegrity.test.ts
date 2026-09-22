import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { prepareEmotionExecution,acceptEmotionExecution } from './index';
import { request,runnerSource,change,value } from './ExecutionFixtures.test-support';
const running=()=>{const r=request('ANGER',{runningRiskDelta:0.4});return {...r,runner:runnerSource(r)};};
describe('execution immutable boundary adversarial checks',()=>{
 for(const bad of [null,undefined,[],42,'source',new Date()])it('rejects non-request '+String(bad),()=>assert.equal(prepareEmotionExecution(bad).ok,false));
 for(const [name,edit] of [
  ['blank execution ID',(d:any)=>d.executionId=' '],['negative world revision',(d:any)=>d.frame.worldRevision=-1],
  ['fractional tick',(d:any)=>d.frame.time.tick=100.2],['infinite bound',(d:any)=>d.baseline.swingDecision.latestTick=Infinity],
  ['non-integer scale',(d:any)=>d.model.runningRiskTicksPerUnit=1.5],['extra scalar effect',(d:any)=>d.baseline.flatPowerBonus=1],
  ['missing attention target',(d:any)=>d.runner.decision.perceivedWorld.attention.target=null],
  ['unknown attention target',(d:any)=>d.runner.decision.perceivedWorld.attention.target={kind:'omniscient'}],
  ['invalid attention base',(d:any)=>d.runner.decision.perceivedWorld.attention.target={kind:'base',base:8}],
  ['blank attention identity',(d:any)=>d.runner.decision.perceivedWorld.attention.target={kind:'player',playerId:' '}],
  ['future focus',(d:any)=>d.runner.decision.perceivedWorld.attention.focusedSinceTick=101],
  ['future predicted player',(d:any)=>d.runner.decision.perceivedWorld.players=[{playerId:'other',memory:{predictedAt:101}}]],
  ['old predicted ball',(d:any)=>d.runner.decision.perceivedWorld.ball={predictedAt:99}],
  ['invalid boolean',(d:any)=>d.runner.decision.perceivedWorld.knownContext.forcedToAdvance='no'],
  ['string physical value',(d:any)=>d.runner.parameters.accelerationMps2='4'],
  ['invalid risk probability',(d:any)=>d.runner.decision.minimumCueConfidence=2],
  ['zero tick frequency',(d:any)=>d.runner.parameters.ticksPerSecond=0],
  ['impossible sliding drive',(d:any)=>{d.runner.body.bodyMode='sliding';d.runner.body.driveDirection=1;}],
  ['super-maximum speed',(d:any)=>d.runner.body.speedMps=9],
 ] as const)it('rejects '+name,()=>assert.equal(prepareEmotionExecution(change(running(),edit)).ok,false));
 it('never invokes root getter',()=>{let called=0;const r=request();Object.defineProperty(r,'baseline',{get(){called++;return {};},enumerable:true});assert.equal(prepareEmotionExecution(r).ok,false);assert.equal(called,0);});
 it('never invokes nested runner getter',()=>{let called=0;const r=running();Object.defineProperty(r.runner.decision.perceivedWorld,'knownContext',{get(){called++;return {};},enumerable:true});assert.equal(prepareEmotionExecution(r).ok,false);assert.equal(called,0);});
 it('never invokes proposal getter/toJSON',()=>{let called=0;const r=running(),p=structuredClone(value(prepareEmotionExecution(r)));Object.defineProperty(p.inputs,'throwAggression',{get(){called++;return 0.4;},enumerable:true});assert.equal(acceptEmotionExecution(r,p).ok,false);assert.equal(called,0);});
 it('rejects prototype-bearing nested data',()=>{const r=running();Object.setPrototypeOf(r.runner.body,{hidden:1});assert.equal(prepareEmotionExecution(r).ok,false);});
 it('rejects cyclic metadata before recursion can overflow',()=>{const r=running();(r.runner.decision.perceivedWorld.attention as any).target=r.runner;assert.equal(prepareEmotionExecution(r).ok,false);});
 it('rejects hidden and symbol keys',()=>{for(const key of ['hidden',Symbol('secret')]){const r=running();Object.defineProperty(r.runner.body,key,{value:1,enumerable:false});assert.equal(prepareEmotionExecution(r).ok,false);}});
 it('rejects sparse cue arrays',()=>{const r=running();delete (r.runner.decision.perceivedCues as any)[0];assert.equal(prepareEmotionExecution(r).ok,false);});
 it('cannot feed effective inputs directly back as a baseline',()=>{const r=request(),p=value(prepareEmotionExecution(r));assert.equal(prepareEmotionExecution({...r,baseline:p.inputs}).ok,false);});
 it('old candidate magnitudes never affect a fresh independent baseline',()=>{const r=running(),p=value(prepareEmotionExecution(r));assert.equal(p.inputs.minimumAdvanceSafetyMarginTicks,60);const q=change(request(),d=>{d.baseline.minimumAdvanceSafetyMarginTicks=75;});assert.equal(value(prepareEmotionExecution(q)).inputs.minimumAdvanceSafetyMarginTicks,75);});
 it('no false pending runner state after rejected event scope',()=>{const r=change(running(),d=>d.appraisal.event.scope={...d.appraisal.event.scope,playerId:'another'}),out=prepareEmotionExecution(r);assert.equal(out.ok,false);assert.ok(!('value' in out));});
 it('acceptance rejects deleted, additional, or cyclic proof fields',()=>{for(const mode of ['deleted','additional','cycle']){const r=running(),p:any=structuredClone(value(prepareEmotionExecution(r)));if(mode==='deleted')delete p.inputs.realized;else if(mode==='additional')p.hidden=1;else p.hidden=p;assert.equal(acceptEmotionExecution(r,p).ok,false);}});
 it('diagnostics show saturation with zero realized risk change',()=>{const r=change(request('ANGER',{runningRiskDelta:1}),d=>d.baseline.minimumAdvanceSafetyMarginTicks=0);const p=value(prepareEmotionExecution(r));assert.equal(p.appraisal.influence.activeEmotion,'ANGER');assert.equal(p.inputs.realized.safetyMarginDeltaTicks,0);});
});
