import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { resolvePitchCountRule } from '../../core/rules/PitchCountRule';
import { resolveFoulBallRule } from '../../core/rules/FoulBallRule';
import { resolveFlyCatch } from '../../core/rules/FlyCatchRule';
import { resolveWalkForcedAdvancement } from '../../core/rules/WalkAdvancementRule';
import { resolveHalfInningTransition } from '../../core/rules/HalfInningTransitionRule';
import { createInitialForceObligationState,deriveCurrentForceObligations,retireForceParticipant,satisfyForceParticipantObligation } from '../../core/rules/ForceObligation';
import { resolveThirdOutScoring,type CorrectOutClassification } from '../../core/rules/ThirdOutScoring';
import { finalizePendingRunsAtPlayEnd } from '../../core/rules/PlayRunFinalization';
import type { BaseballBase,RunnerBaseTouchFact,ControlledBaseContactFact,ControlledRunnerTagFact,RunnerBaseDepartureFact,PlayEndFact } from '../../core/rules/PhysicalRuleFacts';

/** Browser-neutral adapter for actual offline physical facts. These records do
 * not claim SQLite ownership, a scorer's H/E judgment or empirical SI calibration. */
export type PlayableFieldFactsV1=Readonly<{
  contactTick:number;throughTick:number;territory:'fair'|'foul';firstGroundContactTick?:number|null;
  flyCatch:Readonly<{fielderId:string;firstTouchTick:number;secureCatchTick:number}>|null;
  runnerTouches:readonly RunnerBaseTouchFact[];controlledBaseContacts:readonly ControlledBaseContactFact[];
  controlledRunnerTags:readonly ControlledRunnerTagFact[];runnerDepartures:readonly RunnerBaseDepartureFact[];
  overFence:Readonly<{tick:number;fair:boolean;untouchedGround:boolean;cause?:'batted'|'throw';awardFrom?:Readonly<Record<string,number>>}>|null;playEnd:PlayEndFact;buntAttempt?:boolean;
}>;
export type PlayableRunnerOutV1=Readonly<{runnerId:string;tick:number;classification:CorrectOutClassification;cause:'base_control'|'runner_tag'|'fly_catch'|'pitch_count';defenderId:string|null}>;
export type PlayableMatchRuleInputV1=Readonly<{
  match:CanonicalMatchState;batterRunnerId:string;regulationInnings?:number;
  event:Readonly<{kind:'pitch_call';tick:number;call:'ball'|'called_strike'|'swinging_strike'}>|Readonly<{kind:'field_play';facts:PlayableFieldFactsV1}>;
}>;
type Classification='count'|'foul'|'walk'|'strikeout'|'live_ball'|'home_run'|'ground_rule_double'|'fly_out'|'foul_out';
export type PlayableMatchRuleResultV1=Readonly<{kind:'unresolved';reason:string;tick:number}>|Readonly<{
  kind:'applied';match:CanonicalMatchState;batterAdvanced:boolean;halfChanged:boolean;gameOver:boolean;winner:'away'|'home'|null;
  scoredRunnerIds:readonly string[];suppressedRunnerIds:readonly string[];outcomes:readonly PlayableRunnerOutV1[];
  endedAtTick:number;classification:Classification;
}>;
const names=['first','second','third'] as const;
const tick=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const id=(s:string)=>typeof s==='string'&&s.length>0&&s===s.trim();
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('playable match rules: '+message);}
const unresolved=(reason:string,time:number):PlayableMatchRuleResultV1=>({kind:'unresolved',reason,tick:time});
function validateMatch(m:CanonicalMatchState,batter:string){
  assert(id(m.ruleProfileId)&&Number.isSafeInteger(m.inning)&&m.inning>=1&&['top','bottom'].includes(m.half)
    &&Number.isInteger(m.outs)&&m.outs>=0&&m.outs<=2&&Number.isSafeInteger(m.playId)&&m.playId>=0,'invalid active canonical match');
  resolvePitchCountRule(m,{kind:'ball_in_play'});
  assert([m.score.away,m.score.home].every(n=>Number.isSafeInteger(n)&&n>=0),'invalid score');
  const runners=names.map(n=>m.bases[n]).filter((r):r is string=>r!==null);
  assert(id(batter)&&runners.every(id)&&!runners.includes(batter)&&new Set(runners).size===runners.length,'invalid original runner identities');
}
function finish(input:PlayableMatchRuleInputV1,after:CanonicalMatchState,batterAdvanced:boolean,classification:Classification,
  scored:readonly RunnerBaseTouchFact[],suppressed:readonly RunnerBaseTouchFact[],outcomes:readonly PlayableRunnerOutV1[],endedAtTick:number):PlayableMatchRuleResultV1{
  const regulation=input.regulationInnings??9,batting=input.match.half==='top'?'away':'home';
  let scoredFinal=[...scored],outsFinal=[...outcomes],end=endedAtTick;
  const walkoff=input.match.half==='bottom'&&input.match.inning>=regulation
    &&input.match.score.home+scored.length>input.match.score.away;
  if(walkoff&&classification!=='home_run'){
    const needed=input.match.score.away-input.match.score.home+1;scoredFinal=scoredFinal.slice(0,Math.max(0,needed));
    if(scoredFinal.length){
      end=scoredFinal.at(-1)!.tick;
      if(input.event.kind==='field_play'){
        const first=input.event.facts.runnerTouches.find(t=>t.runnerId===input.batterRunnerId&&t.base===1);
        if(first)end=Math.max(end,first.tick);
      }
      outsFinal=outsFinal.filter(o=>o.tick<=end);
    }
  }
  const score={...input.match.score,[batting]:input.match.score[batting]+scoredFinal.length};
  let match:CanonicalMatchState={...after,score,outs:input.match.outs+outsFinal.length,
    balls:batterAdvanced?0:after.balls,strikes:batterAdvanced?0:after.strikes,playId:input.match.playId+(batterAdvanced?1:0)};
  const homeWins=match.inning>=regulation&&((match.half==='bottom'&&score.home>score.away)||(match.half==='top'&&match.outs===3&&score.home>score.away));
  const awayWins=match.inning>=regulation&&match.half==='bottom'&&match.outs===3&&score.away>score.home;
  const gameOver=homeWins||awayWins;let halfChanged=false;
  if(!gameOver){const transition=resolveHalfInningTransition({inning:match.inning,half:match.half,outsAfterPlay:match.outs});
    if(transition.kind==='half_inning_ended'){halfChanged=true;match={...match,inning:transition.nextInning,half:transition.nextHalf,...transition.reset};}}
  return {kind:'applied',match,batterAdvanced,halfChanged,gameOver,winner:homeWins?'home':awayWins?'away':null,
    scoredRunnerIds:scoredFinal.map(t=>t.runnerId),suppressedRunnerIds:[...suppressed,...scored.filter(t=>!scoredFinal.includes(t))].map(t=>t.runnerId),
    outcomes:outsFinal,endedAtTick:end,classification};
}
function applyCount(input:PlayableMatchRuleInputV1,call:'ball'|'called_strike'|'swinging_strike'|'foul'|'foul_bunt',time:number):PlayableMatchRuleResultV1{
  const m=input.match,r=resolvePitchCountRule(m,{kind:call});
  if(r.kind==='continue')return finish(input,{...m,...r.count},false,call==='foul'?'foul':'count',[],[],[],time);
  if(r.kind==='walk'){
    const a=resolveWalkForcedAdvancement({batterRunnerId:input.batterRunnerId,bases:m.bases});
    return finish(input,{...m,bases:a.bases},true,'walk',a.scoredRunnerIds.map(runnerId=>({kind:'runner_base_touch',runnerId,base:4,tick:time})),[],[],time);
  }
  assert(r.kind==='strikeout','count adjudication did not resolve');
  return finish(input,m,true,'strikeout',[],[],[{runnerId:input.batterRunnerId,tick:time,classification:'batter_runner_before_first',cause:'pitch_count',defenderId:null}],time);
}

export function reducePlayableMatchV1(raw:PlayableMatchRuleInputV1):PlayableMatchRuleResultV1{
  const input=cloneInert(raw),m=input.match,batter=input.batterRunnerId,regulation=input.regulationInnings??9;
  validateMatch(m,batter);assert(Number.isSafeInteger(regulation)&&regulation>=1,'invalid regulation innings');
  if(input.event.kind==='pitch_call'){assert(tick(input.event.tick),'invalid pitch call tick');return applyCount(input,input.event.call,input.event.tick);}
  const f=input.event.facts;assert(tick(f.contactTick)&&tick(f.throughTick)&&f.throughTick>=f.contactTick
    &&f.playEnd.kind==='play_end'&&tick(f.playEnd.tick)&&f.playEnd.tick>=f.contactTick&&f.playEnd.tick<=f.throughTick
    &&['fair','foul'].includes(f.territory),'invalid physical play interval or territory');
  const validTime=(t:number)=>tick(t)&&t>=f.contactTick&&t<=f.throughTick;
  if(f.firstGroundContactTick!==undefined&&f.firstGroundContactTick!==null)assert(validTime(f.firstGroundContactTick),'invalid ground contact tick');
  const caught=f.flyCatch?resolveFlyCatch({batterRunnerId:batter,firstTouch:{kind:'fly_ball_first_fielder_touch',fielderId:f.flyCatch.fielderId,tick:f.flyCatch.firstTouchTick},
    secureCatchTick:f.flyCatch.secureCatchTick,firstGroundContactTick:f.firstGroundContactTick??null}):null;
  if(f.flyCatch)assert(id(f.flyCatch.fielderId)&&validTime(f.flyCatch.firstTouchTick)&&validTime(f.flyCatch.secureCatchTick),'invalid catch facts');
  const foul=resolveFoulBallRule({territory:f.territory,buntAttempt:f.buntAttempt??false,count:m,flyCatch:caught});
  if(foul.kind==='uncaught_foul')return applyCount(input,f.buntAttempt?'foul_bunt':'foul',f.playEnd.tick);
  if(foul.kind==='unresolved_foul_fly')return unresolved('unresolved_foul_catch',foul.firstFielderTouchTick);
  if(f.overFence)assert(validTime(f.overFence.tick)&&typeof f.overFence.fair==='boolean'&&typeof f.overFence.untouchedGround==='boolean','invalid fence fact');
  const homeRun=!!f.overFence&&f.overFence.fair&&f.overFence.untouchedGround&&f.territory==='fair'
    &&(f.firstGroundContactTick===undefined||f.firstGroundContactTick===null||f.firstGroundContactTick>f.overFence.tick);
  const groundRuleAward=!!f.overFence&&f.overFence.fair&&!f.overFence.untouchedGround&&f.territory==='fair'
    &&(f.overFence.cause==='throw'||f.firstGroundContactTick!==undefined&&f.firstGroundContactTick!==null&&f.firstGroundContactTick<=f.overFence.tick);
  if(f.overFence&&!homeRun&&!groundRuleAward)return unresolved('ground_rule_award_requires_out_of_play_geometry',f.overFence.tick);
  let force=createInitialForceObligationState(m.bases,batter);
  const runners=force.participants.map(p=>p.runnerId),atBase=new Map<string,BaseballBase|null>(),progress=new Map<string,number>();
  for(const p of force.participants){atBase.set(p.runnerId,p.startBase===0?null:p.startBase);progress.set(p.runnerId,p.startBase);}
  const retired=new Set<string>(),homes:RunnerBaseTouchFact[]=[],outcomes:PlayableRunnerOutV1[]=[];
  type Event=RunnerBaseTouchFact|RunnerBaseDepartureFact|ControlledBaseContactFact|ControlledRunnerTagFact|Readonly<{kind:'fly_catch';tick:number;defenderId:string}>;
  const events:Event[]=[...f.runnerTouches,...f.runnerDepartures,...f.controlledBaseContacts,...f.controlledRunnerTags,
    ...(caught?.kind==='caught'?[{kind:'fly_catch' as const,tick:caught.outTick,defenderId:f.flyCatch!.fielderId}]:[])];
  for(const e of events){assert(validTime(e.tick),'fact outside physical play interval');
    if('runnerId' in e)assert(runners.includes(e.runnerId),'unknown physical runner');
    if('base' in e)assert([1,2,3,4].includes(e.base),'invalid physical base');
    if('defenderId' in e)assert(id(e.defenderId),'invalid physical defender');
    if(e.kind==='controlled_runner_tag'&&e.protectionEndedByDeparture){const proof=e.protectionEndedByDeparture;
      assert([1,2,3,4].includes(proof.base)&&validTime(proof.tick)&&proof.tick===e.tick,'invalid tag departure evidence');}}
  const retire=(runnerId:string,time:number,classification:CorrectOutClassification,cause:PlayableRunnerOutV1['cause'],defenderId:string)=>{
    if(retired.has(runnerId)||m.outs+outcomes.length>=3)return;
    retired.add(runnerId);atBase.set(runnerId,null);force=retireForceParticipant(force,runnerId);outcomes.push({runnerId,tick:time,classification,cause,defenderId});
  };
  events.sort((a,b)=>a.tick-b.tick);
  for(let offset=0;offset<events.length;){
    const time=events[offset].tick,group:Event[]=[];while(offset<events.length&&events[offset].tick===time)group.push(events[offset++]);
    if(time>f.playEnd.tick||m.outs+outcomes.length>=3)break;
    // Equal authoritative ticks retain uncertainty instead of array-order outs.
    const forceTargets=deriveCurrentForceObligations(force).filter(o=>group.some(e=>e.kind==='controlled_base_contact'&&e.base===o.targetBase));
    if(forceTargets.length>1)return unresolved('simultaneous_multiple_force_plays',time);
    for(const control of group.filter((e):e is ControlledBaseContactFact=>e.kind==='controlled_base_contact')){
      const obligation=deriveCurrentForceObligations(force).find(o=>o.targetBase===control.base);
      if(obligation&&group.some(e=>e.kind==='runner_base_touch'&&e.runnerId===obligation.runnerId&&e.base===control.base))return unresolved('simultaneous_force_arrival',time);
    }
    for(const tag of group.filter((e):e is ControlledRunnerTagFact=>e.kind==='controlled_runner_tag')){
      // An incoming touch remains a race. A proven outgoing protection exit
      // can instead enable an already-overlapping glove in the same tick.
      if(group.some(e=>e.kind==='runner_base_touch'&&e.runnerId===tag.runnerId))return unresolved('simultaneous_tag_arrival_or_departure',time);
      const departures=group.filter((e):e is RunnerBaseDepartureFact=>e.kind==='runner_base_departure'&&e.runnerId===tag.runnerId),proof=tag.protectionEndedByDeparture,
        bound=!!proof&&departures.length===1&&departures[0].base===proof.base&&departures[0].tick===proof.tick
          &&atBase.get(tag.runnerId)===proof.base&&!deriveCurrentForceObligations(force).some(o=>o.runnerId===tag.runnerId);
      if(proof&&!bound)return unresolved('unbound_tag_departure_evidence',time);
      if(departures.length&&!bound)return unresolved('simultaneous_tag_arrival_or_departure',time);
    }
    for(const e of group.filter(e=>e.kind==='fly_catch'))retire(batter,time,'batter_runner_before_first','fly_catch',e.defenderId);
    for(const e of group.filter((a):a is RunnerBaseDepartureFact=>a.kind==='runner_base_departure')){
      if(!retired.has(e.runnerId)&&atBase.get(e.runnerId)===e.base)atBase.set(e.runnerId,null);
    }
    for(const e of group.filter((a):a is RunnerBaseTouchFact=>a.kind==='runner_base_touch')){
      if(retired.has(e.runnerId))continue;
      const prior=progress.get(e.runnerId)!;
      if(Math.abs(e.base-prior)>1)return unresolved('missing_sequential_base_touch',time);
      progress.set(e.runnerId,e.base);atBase.set(e.runnerId,e.base);
      const obligation=deriveCurrentForceObligations(force).find(o=>o.runnerId===e.runnerId&&o.targetBase===e.base);
      if(obligation)force=satisfyForceParticipantObligation(force,e.runnerId);
      if(e.base===4&&!homes.some(h=>h.runnerId===e.runnerId))homes.push(e);
    }
    for(const e of group.filter((a):a is ControlledBaseContactFact=>a.kind==='controlled_base_contact')){
      const obligation=deriveCurrentForceObligations(force).find(o=>o.targetBase===e.base);
      if(obligation)retire(obligation.runnerId,time,obligation.classification,'base_control',e.defenderId);
    }
    for(const e of group.filter((a):a is ControlledRunnerTagFact=>a.kind==='controlled_runner_tag')){
      if(retired.has(e.runnerId))continue;
      const obligation=deriveCurrentForceObligations(force).find(o=>o.runnerId===e.runnerId),protectedBase=atBase.get(e.runnerId);
      if(protectedBase!==null&&(!obligation||obligation.targetBase===protectedBase))continue;
      retire(e.runnerId,time,obligation?.classification??'time_play','runner_tag',e.defenderId);
    }
  }
  const third=m.outs+outcomes.length===3?outcomes.at(-1)!:null;
  let scored:readonly RunnerBaseTouchFact[]=homes,suppressed:readonly RunnerBaseTouchFact[]=[];
  if(third){const r=resolveThirdOutScoring({outsAtStart:2,thirdOutCandidate:{runnerId:third.runnerId,outTick:third.tick,classification:third.classification},homeTouches:homes});
    if(r.kind==='simultaneous_unresolved')return unresolved('simultaneous_third_out_run',third.tick);
    assert(r.kind==='resolved','third out was not resolved');scored=r.scored;suppressed=r.suppressed;
  }else finalizePendingRunsAtPlayEnd(homes,f.playEnd);
  const bases:{first:string|null;second:string|null;third:string|null}={first:null,second:null,third:null};
  if(!third)for(const runner of runners){
    if(retired.has(runner)||homes.some(h=>h.runnerId===runner))continue;
    const base=atBase.get(runner);if(base===null||base===undefined||base===4)return unresolved('live_runner_stopped_between_bases',f.playEnd.tick);
    if(bases[names[base-1]]!==null)return unresolved('conflicting_base_entitlement',f.playEnd.tick);
    bases[names[base-1]]=runner;
  }
  if(homeRun&&!third&&runners.some(r=>!retired.has(r)&&!homes.some(h=>h.runnerId===r)))return unresolved('home_run_circuits_incomplete',f.playEnd.tick);
  if(groundRuleAward&&!third&&force.participants.some(p=>!retired.has(p.runnerId)&&progress.get(p.runnerId)!<Math.min(4,(f.overFence?.awardFrom?.[p.runnerId]??p.startBase)+2)))
    return unresolved('ground_rule_award_touches_incomplete',f.playEnd.tick);
  const classification:Classification=homeRun?'home_run':groundRuleAward?'ground_rule_double':caught?.kind==='caught'?(f.territory==='foul'?'foul_out':'fly_out'):'live_ball';
  return finish(input,{...m,bases},true,classification,scored,suppressed,outcomes,third?.tick??f.playEnd.tick);
}
