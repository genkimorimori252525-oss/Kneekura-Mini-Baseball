import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { appraiseEmotion } from './SourceAppraisal';
import { deriveMatchImportance } from './MatchImportance';
import { evaluateAppraisedEmotion } from './AppraisalGate';
import { appraisalInput,importanceInput,change,value } from './AppraisalFixtures.test-support';
import { createEmotionState } from '../EmotionState';
describe('appraisal adversarial integrity',()=>{
 for(const field of ['swingDecisionShiftTicks','throwIntentShiftTicks','defenseReplanShiftTicks'])it('rejects normalization saturation for '+field,()=>{
  const x=change(appraisalInput(),d=>{d.model.rows[0].effectsAtFullPressure[field]=11;});
  assert.equal(appraiseEmotion(x).ok,false);
 });
 it('preserves proportional tiny importance weights',()=>{
  const x=importanceInput(),tiny=change(x,d=>{for(const k in d.model.weights)d.model.weights[k]=1e-320;});
  assert.equal(value(deriveMatchImportance(tiny)).value,value(deriveMatchImportance(x)).value);
 });
 it('rounds opposite tick shifts symmetrically',()=>{
  const x=change(appraisalInput(),d=>{d.model.importanceGain=0;for(const r of d.model.rows){r.bias=0.5;r.stabilityDamping=0;for(const k in r.situationWeights)r.situationWeights[k]=0;for(const k in r.responseWeights)r.responseWeights[k]=0;
   r.effectsAtFullPressure.swingDecisionShiftTicks=1;r.effectsAtFullPressure.throwIntentShiftTicks=-1;}});
  for(const c of value(appraiseEmotion(x)).appraisal.candidates){assert.equal(c.effects.swingDecisionShiftTicks,1);assert.equal(c.effects.throwIntentShiftTicks,-1);}
 });
 it('does not trigger any getters in supplied records',()=>{
  const x=appraisalInput();let reads=0;Object.defineProperty(x.player.response,'stability',{enumerable:true,get:()=>{reads++;return 0;}});
  assert.equal(appraiseEmotion(x).ok,false);assert.equal(reads,0);
 });
 for(const [name,edit] of [
  ['sparse rows',(d:any)=>delete d.model.rows[2]],['row accessor',(d:any)=>Object.defineProperty(d.model.rows,'0',{enumerable:true,get:()=>{throw new Error('must not run');}})],
  ['hidden metadata',(d:any)=>Object.defineProperty(d.event,'secret',{value:1})],['symbol field',(d:any)=>d.player[Symbol('x')]=1],
  ['custom prototype',(d:any)=>Object.setPrototypeOf(d.player,{injected:1})],['array extra property',(d:any)=>d.evidenceEventIds.extra=1],
  ['cyclic response',(d:any)=>d.player.response=d.player],['string numeric',(d:any)=>d.event.expectedOutcome='0.5'],
  ['negative age',(d:any)=>d.model.maxSourceAgeTicks=-1],['fractional time',(d:any)=>d.importance.time.tick=100.5],
  ['unsafe revision',(d:any)=>d.player.stamp.revision=Number.MAX_SAFE_INTEGER+1],['negative remaining schedule',(d:any)=>d.importance.competition.remainingGamesAfterMatch=-1],
  ['different rivalry career',(d:any)=>d.importance.rivalry.careerId='other'],['opponent snapshot mismatch',(d:any)=>d.importance.competition.opponentClubId='other'],
  ['different personal club',(d:any)=>d.importance.personal.clubId='other'],['unexpected stage',(d:any)=>d.importance.competition.stage='MANUAL_BIG_GAME'],
  ['loss-only championship',(d:any)=>{d.importance.competition.loss.champion=true;d.importance.competition.loss.qualified=true;}],
  ['inverse opponent ranks',(d:any)=>{d.importance.competition.win.opponentRank=1;d.importance.competition.loss.opponentRank=2;}],['boolean as rank',(d:any)=>d.importance.competition.win.rank=true],
  ['long-term strain as emotion name',(d:any)=>d.player.longTermStrain='ANGER'],
 ] as const)it('rejects '+name,()=>assert.equal(appraiseEmotion(change(appraisalInput(),edit)).ok,false));
 it('rejects a corrupted stored active state before proposing changes',()=>{
  const x=appraisalInput(),s=value(createEmotionState({scope:x.importance.scope,policy:x.policy}));
  assert.equal(evaluateAppraisedEmotion({...s,calmObservations:1},x).ok,false);
 });
 it('a rare high-pressure response can occur in a stable player without a candidate flag',()=>{
  const ordinary=change(appraisalInput(),d=>{d.player.response.stability=1;d.player.response.experience=1;
   for(const row of d.model.rows){for(const k in row.situationWeights)row.situationWeights[k]=0;for(const k in row.responseWeights)row.responseWeights[k]=0;row.bias=0;}
   const fear=d.model.rows.find((r:any)=>r.emotion==='FEAR');fear.bias=0.8;fear.responseWeights.stability=-0.35;});
  const high=change(ordinary,d=>{d.importance.competition.stage='FINAL';for(const k in d.importance.model.weights)d.importance.model.weights[k]=k==='stage'?1:0;});
  const run=(x:typeof high)=>value(evaluateAppraisedEmotion(value(createEmotionState({scope:x.importance.scope,policy:x.policy})),x));
  assert.equal(run(ordinary).influence.activeEmotion,null);assert.equal(run(high).influence.activeEmotion,'FEAR');
 });
});
