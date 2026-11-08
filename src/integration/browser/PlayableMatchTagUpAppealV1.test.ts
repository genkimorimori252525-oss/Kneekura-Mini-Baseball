import { expect,it } from 'vitest';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { DefensiveAppealAttemptFact } from '../../core/rules/PhysicalRuleFacts';
import { reducePlayableMatchV1,type PlayableFieldFactsV1,type PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';

const state=(patch:Partial<CanonicalMatchState>={}):CanonicalMatchState=>({ruleProfileId:asRuleProfileId('offline-nine'),inning:1,half:'top',outs:0,balls:0,strikes:0,
  bases:{first:'r1',second:null,third:null},score:{away:0,home:0},playId:0,...patch});
const leave=(runnerId:string,base:1|2|3|4,tick:number)=>({kind:'runner_base_departure' as const,runnerId,base,tick});
const touch=(runnerId:string,base:1|2|3|4,tick:number)=>({kind:'runner_base_touch' as const,runnerId,base,tick});
const control=(base:1|2|3|4,tick:number,defenderId='ss')=>({kind:'controlled_base_contact' as const,defenderId,base,tick});
const appeal=(runnerId='r1',base:1|2|3|4=1,tick=40,defenderId='ss'):DefensiveAppealAttemptFact=>({kind:'defensive_appeal_attempt',defenderId,runnerId,base,reason:'tag_up_early_departure',tick});
const field=(patch:Partial<PlayableFieldFactsV1>={}):PlayableFieldFactsV1=>({contactTick:0,throughTick:100,territory:'fair',firstGroundContactTick:null,
  flyCatch:{fielderId:'cf',firstTouchTick:20,secureCatchTick:22},runnerTouches:[touch('r1',1,50)],runnerDepartures:[leave('r1',1,10)],
  controlledBaseContacts:[],controlledRunnerTags:[],overFence:null,playEnd:{kind:'play_end',tick:100,reason:'live_action_complete'},...patch});
const live=(facts:PlayableFieldFactsV1,match=state())=>reducePlayableMatchV1({match,batterRunnerId:'b',event:{kind:'field_play',facts}});
function applied(r:PlayableMatchRuleResultV1){expect(r.kind).toBe('applied');if(r.kind!=='applied')throw new Error(r.reason);return r;}

it('requires an explicit appeal instead of treating a caught-fly return as a force play',()=>{
  const r=applied(live(field({controlledBaseContacts:[control(1,40)]})));
  expect(r.outcomes.map(o=>o.runnerId)).toEqual(['b']);expect(r.match.bases.first).toBe('r1');
});
it('sustains an explicit original-base appeal bound to actual control before the actual retouch',()=>{
  const facts=field({defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]}),before=JSON.stringify(facts),r=applied(live(facts));
  expect(r.outcomes.at(-1)).toEqual({runnerId:'r1',tick:40,classification:'time_play',cause:'tag_up_appeal',defenderId:'ss'});
  expect(r.match.outs).toBe(2);expect(r.match.bases.first).toBeNull();expect(JSON.stringify(facts)).toBe(before);
});
it('dissolves force obligations at the catch occurrence before evaluating simultaneous base controls',()=>{
  const bare=applied(live(field({controlledBaseContacts:[control(1,22),control(2,22)]})));
  expect(bare.outcomes.map(o=>o.runnerId)).toEqual(['b']);
  const explicit=applied(live(field({defensiveAppeals:[appeal('r1',1,22)],controlledBaseContacts:[control(1,22)]})));
  expect(explicit.outcomes.at(-1)).toMatchObject({runnerId:'r1',tick:22,cause:'tag_up_appeal',classification:'time_play'});
});
it.each([
  {controlledBaseContacts:[],reason:'unbound_tag_up_appeal_control'},
  {controlledBaseContacts:[control(1,39)],reason:'unbound_tag_up_appeal_control'},
  {controlledBaseContacts:[control(1,40,'other')],reason:'unbound_tag_up_appeal_control'},
  {controlledBaseContacts:[control(2,40)],reason:'unbound_tag_up_appeal_control'},
])('does not accept a control proxy with the wrong occurrence, defender or base: $reason',({reason,...patch})=>{
  expect(live(field({defensiveAppeals:[appeal()],...patch}))).toEqual({kind:'unresolved',reason,tick:40});
});
it('rejects an appeal against a base other than the original base',()=>{
  expect(live(field({defensiveAppeals:[appeal('r1',2)],controlledBaseContacts:[control(2,40)]})))
    .toEqual({kind:'unresolved',reason:'unbound_tag_up_origin',tick:40});
});
it('requires a secured catch and an actual original-base departure',()=>{
  expect(live(field({flyCatch:null,firstGroundContactTick:25,defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})))
    .toEqual({kind:'unresolved',reason:'tag_up_appeal_requires_catch',tick:40});
  expect(live(field({runnerDepartures:[],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})))
    .toEqual({kind:'unresolved',reason:'unbound_tag_up_departure_evidence',tick:40});
  expect(live(field({defensiveAppeals:[appeal('r1',1,21)],controlledBaseContacts:[control(1,21)]})))
    .toEqual({kind:'unresolved',reason:'tag_up_appeal_requires_catch',tick:21});
  expect(live(field({runnerDepartures:[leave('r1',1,16)],runnerTouches:[touch('r1',2,15)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})))
    .toEqual({kind:'unresolved',reason:'unbound_tag_up_departure_evidence',tick:40});
});
it.each([20,21])('allows departure at/after first fielder touch (%i), before secure catch',departureTick=>{
  const r=applied(live(field({runnerDepartures:[leave('r1',1,departureTick)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(r.outcomes.map(o=>o.runnerId)).toEqual(['b']);
});
it('allows a complete retouch before appeal and preserves an unproved same-tick retouch race',()=>{
  const before=applied(live(field({runnerTouches:[touch('r1',1,39)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(before.outcomes.map(o=>o.runnerId)).toEqual(['b']);
  expect(live(field({runnerTouches:[touch('r1',1,40)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})))
    .toEqual({kind:'unresolved',reason:'simultaneous_tag_up_retouch',tick:40});
});
it('recognizes continuous original-base contact when the early runner returned before first touch',()=>{
  const r=applied(live(field({runnerTouches:[touch('r1',1,19)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(r.outcomes.map(o=>o.runnerId)).toEqual(['b']);expect(r.match.bases.first).toBe('r1');
});
it('uses the latest actual departure after an early return to distinguish a legal new start',()=>{
  const legal=applied(live(field({runnerDepartures:[leave('r1',1,10),leave('r1',1,21)],runnerTouches:[touch('r1',1,19),touch('r1',2,30)],
    defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(legal.outcomes.map(o=>o.runnerId)).toEqual(['b']);expect(legal.match.bases.second).toBe('r1');
  const early=applied(live(field({runnerDepartures:[leave('r1',1,10),leave('r1',1,19)],runnerTouches:[touch('r1',1,18),touch('r1',2,30)],
    defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(early.outcomes.at(-1)?.cause).toBe('tag_up_appeal');
});
it('does not revive an already corrected violation when another origin touch shares the appeal tick',()=>{
  const r=applied(live(field({runnerTouches:[touch('r1',1,30),touch('r1',1,40)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(r.outcomes.map(o=>o.runnerId)).toEqual(['b']);
});
it('binds an explicit appeal to a runner tag even while that early runner stands on the next base',()=>{
  const r=applied(live(field({runnerTouches:[touch('r1',2,30)],defensiveAppeals:[appeal()],controlledRunnerTags:[{kind:'controlled_runner_tag',defenderId:'ss',runnerId:'r1',tick:40}]})));
  expect(r.outcomes.at(-1)).toMatchObject({runnerId:'r1',classification:'time_play',cause:'tag_up_appeal'});
});
it('requires actual reverse sequential retouches after the runner has passed another base',()=>{
  expect(live(field({runnerTouches:[touch('r1',2,13),touch('r1',3,17),touch('r1',1,35)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})))
    .toEqual({kind:'unresolved',reason:'missing_sequential_base_touch',tick:35});
  const r=applied(live(field({runnerTouches:[touch('r1',2,13),touch('r1',3,17),touch('r1',2,30),touch('r1',1,35)],defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]})));
  expect(r.outcomes.map(o=>o.runnerId)).toEqual(['b']);
});
it('counts a preceding runner home before a third-out appeal because retouch is not a force',()=>{
  const r=applied(live(field({runnerDepartures:[leave('r1',1,10),leave('r3',3,21)],runnerTouches:[touch('r3',4,30)],
    defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]}),state({outs:1,bases:{first:'r1',second:null,third:'r3'}})));
  expect(r.halfChanged).toBe(true);expect(r.scoredRunnerIds).toEqual(['r3']);expect(r.match.score.away).toBe(1);expect(r.outcomes.at(-1)?.classification).toBe('time_play');
});
it('suppresses the appealed runner own run even when the appeal is not the third out',()=>{
  const r=applied(live(field({runnerDepartures:[leave('r3',3,10)],runnerTouches:[touch('r3',4,30)],defensiveAppeals:[appeal('r3',3)],controlledBaseContacts:[control(3,40)]}),state({bases:{first:null,second:null,third:'r3'}})));
  expect(r.match.outs).toBe(2);expect(r.scoredRunnerIds).toEqual([]);expect(r.suppressedRunnerIds).toEqual(['r3']);
});
it('keeps an early home crossing pending when no appeal or actual reverse circuit cancels it',()=>{
  const r=applied(live(field({runnerDepartures:[leave('r3',3,5)],runnerTouches:[touch('r3',4,10)]}),state({bases:{first:null,second:null,third:'r3'}})));
  expect(r.scoredRunnerIds).toEqual(['r3']);expect(r.match.score.away).toBe(1);
});
it('removes a prior home crossing when the early runner physically returns to the original third base',()=>{
  const r=applied(live(field({runnerDepartures:[leave('r3',3,5),leave('r3',4,25)],runnerTouches:[touch('r3',4,10),touch('r3',3,30)]}),
    state({bases:{first:null,second:null,third:'r3'}})));
  expect(r.scoredRunnerIds).toEqual([]);expect(r.match.score.away).toBe(0);expect(r.match.bases.third).toBe('r3');
});
it('restores second-base occupancy after an early scoring runner physically retouches third then second in reverse',()=>{
  const r=applied(live(field({runnerDepartures:[leave('r2',2,5),leave('r2',3,11),leave('r2',4,25),leave('r2',3,31)],
    runnerTouches:[touch('r2',3,10),touch('r2',4,15),touch('r2',3,30),touch('r2',2,35)]}),state({bases:{first:null,second:'r2',third:null}})));
  expect(r.scoredRunnerIds).toEqual([]);expect(r.match.score.away).toBe(0);expect(r.match.bases.second).toBe('r2');
});
it.each([{thirdOutTick:40,runs:0},{thirdOutTick:60,runs:null},{thirdOutTick:70,runs:1}])('uses the new legal home occurrence instead of the canceled crossing for a third out at $thirdOutTick',({thirdOutTick,runs})=>{
  const result=live(field({runnerDepartures:[leave('r3',3,5),leave('r3',4,25),leave('r3',3,31),leave('r1',1,21),leave('r1',2,26)],
    runnerTouches:[touch('r3',4,10),touch('r3',3,30),touch('r3',4,60),touch('r1',2,25)],
    controlledRunnerTags:[{kind:'controlled_runner_tag',defenderId:'ss',runnerId:'r1',tick:thirdOutTick}]}),state({outs:1,bases:{first:'r1',second:null,third:'r3'}}));
  if(runs===null){expect(result).toEqual({kind:'unresolved',reason:'simultaneous_third_out_run',tick:60});return;}
  const r=applied(result);
  expect(r.match.score.away).toBe(runs);expect(r.scoredRunnerIds).toEqual(runs?['r3']:[]);expect(r.outcomes.at(-1)?.classification).toBe('time_play');
});
it('suppresses a following runner score on a third-out appeal against a preceding runner',()=>{
  const r=applied(live(field({runnerDepartures:[leave('r3',3,10),leave('r2',2,21)],runnerTouches:[touch('r2',3,25),touch('r2',4,30)],
    defensiveAppeals:[appeal('r3',3)],controlledBaseContacts:[control(3,40)]}),state({outs:1,bases:{first:null,second:'r2',third:'r3'}})));
  expect(r.scoredRunnerIds).toEqual([]);expect(r.suppressedRunnerIds).toEqual(['r2']);expect(r.match.score.away).toBe(0);
});
it('keeps a third appeal out simultaneous with a preceding home touch unresolved',()=>{
  expect(live(field({runnerDepartures:[leave('r1',1,10),leave('r3',3,21)],runnerTouches:[touch('r3',4,40)],
    defensiveAppeals:[appeal()],controlledBaseContacts:[control(1,40)]}),state({outs:1,bases:{first:'r1',second:null,third:'r3'}})))
    .toEqual({kind:'unresolved',reason:'simultaneous_third_out_run',tick:40});
});
