import {it,expect} from 'vitest';
import {asRuleProfileId} from '../../core/model/RuleProfileRef';
import {simulateLiveFieldPlayV1} from '../../core/sim/fielding/LiveFieldPlayV1';
import {buildAverageFieldCaseV95} from './LiveFieldAverageHarnessV95';
import {reducePlayableMatchV1} from './PlayableMatchRulesV1';
import {scoreLivePlayV100,collectLiveErrorCandidatesV100} from './LiveScoringEvidenceV100';
for(const [caseId,variant] of [['SS_ground','baseline'],['RF_ground_pull','baseline'],['second_force','throw_yaw_right'],['RF_gap_runner_second','baseline']] as const)
 it(`derives local scoring from actual ${caseId}/${variant} without altering physical/rule facts`,()=>{
  const {input}=buildAverageFieldCaseV95({caseId,variant,seed:2025,bats:'R',parkRadiusMeters:120}),field=simulateLiveFieldPlayV1(input),
   before={ruleProfileId:asRuleProfileId('npb-2026'),inning:1,half:'top' as const,outs:input.outs,balls:0,strikes:0,
    bases:{first:caseId==='second_force'?'runner-1':null,second:caseId==='RF_gap_runner_second'?'runner-2':null,third:null},score:{away:0,home:0},playId:0},
   rules=reducePlayableMatchV1({match:before,batterRunnerId:'runner-0',regulationInnings:9,event:{kind:'field_play',facts:field.ruleFacts}});
  expect(rules.kind).toBe('applied');if(rules.kind!=='applied')return;
  const original=JSON.stringify({input,field,rules}),scored=scoreLivePlayV100({before,batterRunnerId:'runner-0',bunt:false,rules,input,field,regulationInnings:9});
  expect(JSON.stringify({input,field,rules})).toBe(original);expect(scored.nativeAdmission).toBe(false);
  expect(scored.atTick).toBe(rules.endedAtTick);expect(scored.errors.every(e=>e.tick<=scored.atTick)).toBe(true);
  expect(scored.status).toBe('confirmed');
  console.log(caseId,variant,scored.classification,scored.errors.map(e=>[e.kind,e.reason]));
 },60_000);
it('charges an actual wild first throw only after it loses the ordinary first-base out',()=>{
 const base=buildAverageFieldCaseV95({caseId:'SS_ground',seed:2025,bats:'R',parkRadiusMeters:120}).input,
  input={...base,executionPerturbationsV95:{throwErrors:[{releaseOrdinal:0,yawRadians:.25,pitchRadians:0}]}},field=simulateLiveFieldPlayV1(input),
  before={ruleProfileId:asRuleProfileId('npb-2026'),inning:1,half:'top' as const,outs:0,balls:0,strikes:0,
   bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0},
  rules=reducePlayableMatchV1({match:before,batterRunnerId:'runner-0',regulationInnings:9,event:{kind:'field_play',facts:field.ruleFacts}});
 expect(rules.kind).toBe('applied');if(rules.kind!=='applied')return;
 const scored=scoreLivePlayV100({before,batterRunnerId:'runner-0',bunt:false,rules,input,field,regulationInnings:9});
 expect(scored.errors).toHaveLength(1);expect(scored.errors[0]).toMatchObject({kind:'throwing',reason:'lost_out',fielderId:'def-SS'});
 expect(scored).toMatchObject({classification:'reached_on_error',hits:0,ab:1});
},60_000);
it('keeps different fielders and reacquired possession as separate physical error opportunities',()=>{
 const field={facts:[{kind:'catch_secured',tick:300,playerId:'rf'}],diagnostics:{throwDirectionCommands:[],aiTelemetry:{throwTargetCancellations:[],contactDiagnostics:[
  {elapsedSeconds:100,playerId:'rf',role:'body'},{elapsedSeconds:110,playerId:'rf',role:'body'},
  {elapsedSeconds:200,playerId:'cf',role:'body'},{elapsedSeconds:400,playerId:'rf',role:'body'}]}}} as unknown as Parameters<typeof collectLiveErrorCandidatesV100>[0];
 const {candidates}=collectLiveErrorCandidatesV100(field,1000,s=>s);
 expect(candidates.map(c=>[c.fielderId,c.tick])).toEqual([['rf',100],['cf',200],['rf',400]]);
});
