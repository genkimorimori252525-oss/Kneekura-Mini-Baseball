import assert from 'node:assert/strict';
import type { TraitAssessment, TraitEvaluation, TraitPolicy, TraitResult, TraitState, PreferenceIntentInput } from './TraitTypes';
export function value<T>(r: TraitResult<T>): T { assert.equal(r.ok,true,JSON.stringify(r)); if (!r.ok) throw new Error('rejected'); return r.value; }
export function code(r: TraitResult<unknown>, expected: string): void { assert.equal(r.ok,false); if (!r.ok) assert.equal(r.reason.code,expected); }
export const scope = { careerId:'career',playerId:'player' };
export function policy(): TraitPolicy { return { policyId:'test-only',version:'1',
  learned:[{familyId:'opposite_field_technique',tiers:[
    {stateId:'LEARNED',minimumRepetitions:10,minimumPracticeDays:3,minimumDistinctiveness:0.8},
    {stateId:'MASTERED',minimumRepetitions:30,minimumPracticeDays:10,minimumDistinctiveness:0.9}]}],
  green:[{familyId:'swing_mode_preference',enterThreshold:0.8,leaveThreshold:0.4,minimumObservations:3,minimumDays:7}] }; }
export const creation = () => ({ scope:{...scope},policy:policy() });
export function assessment(stateId: string | null = 'LEARNED'): Extract<TraitAssessment, {kind: 'LEARNED_TECHNIQUE'}> { return {kind:'LEARNED_TECHNIQUE',stateId,
  stage:'CONSOLIDATED',relevantRepetitions:40,practiceDays:15,distinctiveness:1}; }
export function green(stateId = 'POWER', value = 0.9): Extract<TraitAssessment, {kind: 'SLOW_PREFERENCE'}> { return {kind:'SLOW_PREFERENCE',
  support:[{stateId:'POWER',value:stateId==='POWER'?value:0.1},{stateId:'BALANCED',value:stateId==='BALANCED'?value:0.1},
    {stateId:'CONTACT',value:stateId==='CONTACT'?value:0.1}],behavior:'VOLUNTARY',internalized:true}; }
export function evaluation(s: TraitState, familyId='fastball_quality', a: TraitAssessment={kind:'CURRENT_SOURCE',stateId:'B'}, day?:number): TraitEvaluation {
  const last=s.entries.find(x=>x.familyId===familyId)?.lastEvaluation;
  return {scope:{...s.scope},policyRef:{policyId:s.policy.policyId,version:s.policy.version},evaluationId:'evaluation-'+s.revision,
    expectedRevision:s.revision,time:{season:s.time?.season??1,day:day??((s.time?.day??0)+1),sequence:0},familyId,
    source:{sourceKey:'source/'+familyId,sourceRevision:(last?.source.sourceRevision??0)+1,sourceSnapshotId:'snapshot/'+familyId+'/'+s.revision,
      evidenceRevision:(last?.source.evidenceRevision??0)+1,episodeId:'episode/'+familyId+'/'+s.revision,eventIds:['event/'+s.revision],changeKind:'DEVELOPMENT'},assessment:a}; }
export function intent(kind: 'NONE'|'SOFT'|'HARD'='NONE'): PreferenceIntentInput { return { scope:{...scope},familyId:'swing_mode_preference',
  decisionId:'decision',contextId:'context',sourceSnapshotId:'behavior-source',legalActionIds:['power','contact'],
  playerWeights:[{actionId:'power',weight:0.9},{actionId:'contact',weight:0.1}],
  directive:kind==='NONE'?{kind}:kind==='HARD'?{kind,understood:true,accepted:true,actionId:'contact'}:
  {kind,understood:true,accepted:true,managerInfluence:0.75,weights:[{actionId:'power',weight:0.1},{actionId:'contact',weight:0.9}]} }
}
