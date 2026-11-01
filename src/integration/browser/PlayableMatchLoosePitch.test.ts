import { expect,it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { reducePlayableMatchV1,type LoosePitchEventV2,type PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';

const state=(patch:Partial<CanonicalMatchState>={}):CanonicalMatchState=>({ruleProfileId:asRuleProfileId('offline-nine'),inning:1,half:'top',outs:0,balls:0,strikes:0,
  bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0,...patch});
const runner=(runnerId:string,base:number,patch:Partial<LoosePitchEventV2['runners'][number]>={})=>({runnerId,base,retired:false,scored:false,tick:90,defenderId:null,...patch});
function loose(match:CanonicalMatchState,call:LoosePitchEventV2['call'],runners:LoosePitchEventV2['runners'],batterRuns=false){
  const r:PlayableMatchRuleResultV1=reducePlayableMatchV1({match,batterRunnerId:'b',event:{kind:'loose_pitch',tick:10,endTick:100,call,batterRuns,runners}});
  expect(r.kind).toBe('applied');if(r.kind!=='applied')throw new Error(r.reason);return r;
}

it('counts the pitch and keeps the batter up when a runner advances',()=>{
  const r=loose(state({bases:{first:'r1',second:null,third:null}}),'ball',[runner('r1',2)]);
  expect(r.match.balls).toBe(1);expect(r.match.bases).toEqual({first:null,second:'r1',third:null});expect(r.batterAdvanced).toBe(false);
});
it('scores a runner who comes home on a wild pitch',()=>{
  const r=loose(state({bases:{first:null,second:null,third:'r3'}}),'ball',[runner('r3',4,{scored:true})]);
  expect(r.match.score.away).toBe(1);expect(r.match.bases.third).toBeNull();
});
it('pushes forced runners on a walk',()=>{
  const r=loose(state({balls:3,bases:{first:'r1',second:null,third:null}}),'ball',[runner('r1',1)]);
  expect(r.classification).toBe('walk');expect(r.match.bases).toEqual({first:'b',second:'r1',third:null});expect(r.batterAdvanced).toBe(true);
});
it('retires the batter on a third strike when first is occupied with under two outs',()=>{
  const r=loose(state({strikes:2,bases:{first:'r1',second:null,third:null}}),'swinging_strike',[runner('r1',1)]);
  expect(r.classification).toBe('strikeout');expect(r.match.outs).toBe(1);expect(r.match.bases.first).toBe('r1');
});
it('does not let a safe dropped-third batter pass the runner ahead',()=>{
  const r=loose(state({strikes:2,outs:2,bases:{first:'r1',second:null,third:null}}),'swinging_strike',[runner('r1',1),runner('b',1)],true);
  expect(r.match.bases).toEqual({first:'b',second:'r1',third:null});expect(r.match.outs).toBe(2);expect(r.match.score.away).toBe(0);
});
it('counts a batter thrown out at first',()=>{
  const r=loose(state({strikes:2}),'called_strike',[runner('b',0,{retired:true,defenderId:'c'})],true);
  expect(r.match.outs).toBe(1);expect(r.match.bases.first).toBeNull();
});
it('ends the half on a third out and drops a run that scored after it',()=>{
  const r=loose(state({outs:2,bases:{first:'r1',second:null,third:'r3'}}),'ball',[runner('r3',4,{scored:true,tick:95}),runner('r1',1,{retired:true,tick:50,defenderId:'d'})]);
  expect(r.halfChanged).toBe(true);expect(r.match.score.away).toBe(0);
});
it('keeps the batter up next half when a runner is caught for the third out',()=>{
  const r=loose(state({outs:2,balls:1,bases:{first:'r1',second:null,third:null}}),'called_strike',[runner('r1',1,{retired:true,defenderId:'d'})]);
  expect(r.halfChanged).toBe(true);expect(r.batterRetainsTurnV1).toBe(true);expect(r.classification).toBe('live_ball');
});
