import { expect,it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { reducePlayableMatchV1,type PlayableFieldFactsV1,type PlayableMatchRuleInputV1,type PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';
const state=(patch:Partial<CanonicalMatchState>={}):CanonicalMatchState=>({ruleProfileId:asRuleProfileId('offline-nine'),inning:1,half:'top',outs:0,balls:0,strikes:0,
  bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0,...patch});
const touch=(runnerId:string,base:1|2|3|4,tick:number)=>({kind:'runner_base_touch' as const,runnerId,base,tick});
const control=(base:1|2|3|4,tick:number)=>({kind:'controlled_base_contact' as const,defenderId:'d'+base,base,tick});
const tag=(runnerId:string,tick:number)=>({kind:'controlled_runner_tag' as const,defenderId:'d',runnerId,tick});
const leave=(runnerId:string,base:1|2|3|4,tick:number)=>({kind:'runner_base_departure' as const,runnerId,base,tick});
const field=(patch:Partial<PlayableFieldFactsV1>={}):PlayableFieldFactsV1=>({contactTick:0,throughTick:100,territory:'fair',firstGroundContactTick:1,flyCatch:null,
  runnerTouches:[],runnerDepartures:[],controlledBaseContacts:[],controlledRunnerTags:[],overFence:null,playEnd:{kind:'play_end',tick:100,reason:'live_action_complete'},...patch});
const live=(match:CanonicalMatchState,facts:PlayableFieldFactsV1)=>reducePlayableMatchV1({match,batterRunnerId:'b',event:{kind:'field_play',facts}});
function applied(v:PlayableMatchRuleResultV1){expect(v.kind).toBe('applied');if(v.kind!=='applied')throw new Error(v.reason);return v;}
const pitch=(match:CanonicalMatchState,call:'ball'|'called_strike'|'swinging_strike')=>applied(reducePlayableMatchV1({match,batterRunnerId:'b',event:{kind:'pitch_call',tick:10,call}}));

it('uses the existing count rule without advancing batter or play on a nonterminal pitch',()=>{
  const m=state({balls:1,strikes:1}),before=JSON.stringify(m),r=pitch(m,'ball');
  expect(r.match.balls).toBe(2);expect(r.match.strikes).toBe(1);expect(r.batterAdvanced).toBe(false);expect(r.match.playId).toBe(0);expect(JSON.stringify(m)).toBe(before);
});
it('does not add a third strike for an ordinary uncaught foul',()=>{
  const r=applied(live(state({strikes:2}),field({territory:'foul'})));expect(r.match.strikes).toBe(2);expect(r.batterAdvanced).toBe(false);expect(r.match.outs).toBe(0);
});
it('third strike resets count and advances the half immediately on the third out',()=>{
  const r=pitch(state({outs:2,strikes:2,bases:{first:'r1',second:null,third:null}}),'swinging_strike');
  expect(r.halfChanged).toBe(true);expect(r.match.half).toBe('bottom');expect(r.match.outs).toBe(0);expect(r.match.bases).toEqual({first:null,second:null,third:null});
  expect(r.endedAtTick).toBe(10);expect(r.batterAdvanced).toBe(true);expect(r.outcomes[0].cause).toBe('pitch_count');
});
it('walks only force contiguous occupied bases, retaining an unforced runner',()=>{
  const r=pitch(state({balls:3,bases:{first:null,second:'r2',third:'r3'}}),'ball');
  expect(r.match.bases).toEqual({first:'b',second:'r2',third:'r3'});expect(r.scoredRunnerIds).toEqual([]);expect(r.match.playId).toBe(1);
});
it('a bases-loaded ninth-inning walk produces the winning run through the normal walk rule',()=>{
  const r=pitch(state({inning:9,half:'bottom',balls:3,bases:{first:'r1',second:'r2',third:'r3'}}),'ball');
  expect(r.scoredRunnerIds).toEqual(['r3']);expect(r.match.score.home).toBe(1);expect(r.gameOver).toBe(true);expect(r.winner).toBe('home');
});
it('derives a double play from two real base controls, without a double-play scenario',()=>{
  const r=applied(live(state({outs:1,bases:{first:'r1',second:null,third:null}}),field({controlledBaseContacts:[control(2,10),control(1,20)]})));
  expect(r.outcomes.map(o=>[o.runnerId,o.classification])).toEqual([['r1','force'],['b','batter_runner_before_first']]);expect(r.halfChanged).toBe(true);expect(r.endedAtTick).toBe(20);
});
it('supports home-first force plays through the same obligations',()=>{
  const r=applied(live(state({outs:1,bases:{first:'r1',second:'r2',third:'r3'}}),field({controlledBaseContacts:[control(4,10),control(1,20)]})));
  expect(r.outcomes.map(o=>o.runnerId)).toEqual(['r3','b']);expect(r.halfChanged).toBe(true);expect(r.scoredRunnerIds).toEqual([]);
});
it('retiring the batter first removes the force, so a later bare second-base touch cannot retire r1',()=>{
  const r=applied(live(state({bases:{first:'r1',second:null,third:null}}),field({controlledBaseContacts:[control(1,10),control(2,20)]})));
  expect(r.match.outs).toBe(1);expect(r.outcomes.map(o=>o.runnerId)).toEqual(['b']);expect(r.match.bases.first).toBe('r1');
});
it('a third force out suppresses an earlier physical home touch',()=>{
  const r=applied(live(state({outs:2,bases:{first:'r1',second:'r2',third:'r3'}}),field({runnerDepartures:[leave('r3',3,2)],runnerTouches:[touch('r3',4,10)],controlledBaseContacts:[control(2,20)]})));
  expect(r.match.score.away).toBe(0);expect(r.suppressedRunnerIds).toEqual(['r3']);expect(r.outcomes[0].classification).toBe('force');
});
it('a third time-play tag counts a preceding run after the batter has reached first',()=>{
  const r=applied(live(state({outs:2,bases:{first:null,second:null,third:'r3'}}),field({runnerTouches:[touch('b',1,5),touch('r3',4,10)],runnerDepartures:[leave('r3',3,2),leave('b',1,6)],controlledRunnerTags:[tag('b',20)]})));
  expect(r.match.score.away).toBe(1);expect(r.scoredRunnerIds).toEqual(['r3']);expect(r.outcomes[0].classification).toBe('time_play');
});
it('keeps same-tick force/tag/run ordering unresolved instead of using array order',()=>{
  const force=live(state(),field({runnerTouches:[touch('b',1,10)],controlledBaseContacts:[control(1,10)]}));expect(force.kind).toBe('unresolved');
  const run=live(state({outs:2,bases:{first:null,second:null,third:'r3'}}),field({runnerTouches:[touch('b',1,5),touch('r3',4,20)],runnerDepartures:[leave('b',1,6),leave('r3',3,2)],controlledRunnerTags:[tag('b',20)]}));
  expect(run).toEqual({kind:'unresolved',reason:'simultaneous_third_out_run',tick:20});
});
it('protected base contact prevents a tag out after the force has dissolved',()=>{
  const r=applied(live(state({bases:{first:'r1',second:null,third:null}}),field({controlledBaseContacts:[control(1,10)],controlledRunnerTags:[tag('r1',20)]})));
  expect(r.match.outs).toBe(1);expect(r.match.bases.first).toBe('r1');
});
it('a secured foul fly retires the batter while an uncaught foul cannot',()=>{
  const r=applied(live(state({strikes:2}),field({territory:'foul',firstGroundContactTick:null,flyCatch:{fielderId:'catcher',firstTouchTick:10,secureCatchTick:12}})));
  expect(r.classification).toBe('foul_out');expect(r.match.outs).toBe(1);expect(r.batterAdvanced).toBe(true);
});
it('third-out fly catches suppress runs using the existing batter-before-first classification',()=>{
  const r=applied(live(state({outs:2,bases:{first:null,second:null,third:'r3'}}),field({firstGroundContactTick:null,flyCatch:{fielderId:'rf',firstTouchTick:20,secureCatchTick:22},
    runnerDepartures:[leave('r3',3,2)],runnerTouches:[touch('r3',4,10)]})));
  expect(r.match.score.away).toBe(0);expect(r.suppressedRunnerIds).toEqual(['r3']);expect(r.endedAtTick).toBe(22);
});
it('counts all runs on a walk-off homer only after actual sequential circuits',()=>{
  const f=field({firstGroundContactTick:null,overFence:{tick:4,fair:true,untouchedGround:true},runnerDepartures:[leave('r1',1,1)],
    runnerTouches:[touch('r1',2,5),touch('b',1,8),touch('r1',3,10),touch('b',2,12),touch('r1',4,15),touch('b',3,18),touch('b',4,23)]});
  const r=applied(live(state({inning:9,half:'bottom',bases:{first:'r1',second:null,third:null}}),f));
  expect(r.classification).toBe('home_run');expect(r.scoredRunnerIds).toEqual(['r1','b']);expect(r.match.score.home).toBe(2);expect(r.gameOver).toBe(true);expect(r.endedAtTick).toBe(100);
});
it('does not award a homer score or a hit base when actual routes are incomplete',()=>{
  expect(live(state(),field({firstGroundContactTick:null,overFence:{tick:4,fair:true,untouchedGround:true},runnerTouches:[touch('b',1,8)]})))
    .toEqual({kind:'unresolved',reason:'home_run_circuits_incomplete',tick:100});
  expect(live(state(),field({runnerTouches:[touch('b',2,8)]})).kind).toBe('unresolved');
});
it('awards two bases for a fair ball bouncing out only after all actual sequential touches',()=>{
  const f=field({firstGroundContactTick:2,overFence:{tick:4,fair:true,untouchedGround:false},
    runnerDepartures:[leave('r1',1,5),leave('r3',3,5),leave('b',1,10),leave('r1',2,11)],
    runnerTouches:[touch('b',1,8),touch('r1',2,9),touch('r3',4,10),touch('b',2,15),touch('r1',3,16)],
    playEnd:{kind:'play_end',tick:100,reason:'dead_ball'}});
  const r=applied(live(state({bases:{first:'r1',second:null,third:'r3'}}),f));
  expect(r.classification).toBe('ground_rule_double');expect(r.match.bases).toEqual({first:null,second:'b',third:'r1'});
  expect(r.scoredRunnerIds).toEqual(['r3']);expect(r.match.score.away).toBe(1);
});
it('keeps an incomplete physical two-base award unresolved',()=>{
  const r=live(state(),field({firstGroundContactTick:2,overFence:{tick:4,fair:true,untouchedGround:false},runnerTouches:[touch('b',1,8)]}));
  expect(r).toEqual({kind:'unresolved',reason:'ground_rule_award_touches_incomplete',tick:100});
});
it('skips the bottom ninth when home already leads, ends an away win, and preserves a tied extra inning',()=>{
  const home=pitch(state({inning:9,outs:2,strikes:2,score:{away:2,home:3}}),'called_strike');expect(home.gameOver).toBe(true);expect(home.winner).toBe('home');expect(home.match.half).toBe('top');
  const away=pitch(state({inning:9,half:'bottom',outs:2,strikes:2,score:{away:3,home:2}}),'called_strike');expect(away.gameOver).toBe(true);expect(away.winner).toBe('away');
  const tied=pitch(state({inning:9,half:'bottom',outs:2,strikes:2}),'called_strike');expect(tied.gameOver).toBe(false);expect(tied.match.inning).toBe(10);expect(tied.match.half).toBe('top');
});
it('an ordinary walk-off counts only the winning run and requires the batter first-base touch',()=>{
  const r=applied(live(state({inning:9,half:'bottom',bases:{first:null,second:null,third:'r3'}}),field({runnerDepartures:[leave('r3',3,1)],runnerTouches:[touch('r3',4,10),touch('b',1,20)]})));
  expect(r.gameOver).toBe(true);expect(r.scoredRunnerIds).toEqual(['r3']);expect(r.endedAtTick).toBe(20);
});
it('rejects foreign runners and invalid active canonical states',()=>{
  expect(()=>live(state(),field({runnerTouches:[touch('foreign',1,10)]}))).toThrow(/unknown physical runner/);
  const input:PlayableMatchRuleInputV1={match:state({outs:3}),batterRunnerId:'b',event:{kind:'pitch_call',tick:1,call:'ball'}};
  expect(()=>reducePlayableMatchV1(input)).toThrow(/invalid active canonical match/);
});
