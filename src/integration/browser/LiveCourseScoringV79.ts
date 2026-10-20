import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createSourceFreeBallKernel,type SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import { resolveHeightRatioStrikeZoneRegion } from '../../core/sim/pitching/RulebookStrikeZone';
import { classifyBatterCourseV79,validateBatterCourseProfileV79,type BatterCourseProfileV79 } from './BatterCourseProfileV79';
import type { LiveIssuedPitchV1,LivePlayerV1 } from './LiveBaseballMatchV1';

const fail=(s:string):never=>{throw new Error('live course scoring v79: '+s);};
const assert=(v:unknown,s:string):void=>{if(!v)fail(s);};
const id=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=160&&s===s.trim();
const count=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
const nullableTick=(n:unknown)=>n===null||count(n);
export type LiveScoringFactsV79=Readonly<{outsAtStart:number;priorRunnerCount:number;runsScored:number;bunt:boolean;hasFieldFacts:boolean;
  firstDefensiveTouchTick:number|null;firstThrowTick:number|null;batterFirstTouchTick:number|null;
  batterOutBeforeFirst:boolean;otherForceOutBeforeFirst:boolean;caught:boolean;cleanFieldEvidence:boolean;fieldingFailureBeforeFirst:boolean;otherForceChoiceBeforeFirst:boolean}>;
export type LiveScoringDecisionV79=Readonly<{status:'confirmed'|'pending'|'in_progress';ab:number|null;h:number|null;hr:number|null;reason:string}>;
export type LiveCourseObservationV79=Readonly<{position:Readonly<{x:number;y:number}>|null;planeZ:.15;
  provenance:'source_plate_crossing'|'source_estimated_after_front_contact'|'missing_source';
  sourceOriginTick:number|null;crossingElapsedSeconds:number|null;
  zone?:Readonly<{centerX:number;halfWidth:number;lowerY:number;upperY:number}>;courseId?:number|null;courseIndex?:number|null;publicZoneId?:number|null}>;
export type LivePitchSummaryV79=Readonly<{version:'live_pitch_summary_v79';scoringPolicy:'local_physical_scoring_v79_1';pitchId:string;plateAppearanceId:string;
  batterPlayerId:string;pitcherPlayerId:string;before:CanonicalMatchState;after:CanonicalMatchState;endedAtTick:number;
  classification:string;ended:boolean;gameOver:boolean;scoring:LiveScoringDecisionV79;facts:LiveScoringFactsV79;course:LiveCourseObservationV79;
  spray:Readonly<{velocity:Readonly<{x:number;y:number;z:number}>|null;directionIndex:number|null;foul:boolean;homeRun:boolean}>}>;
export type LiveGamePlayerV79=Readonly<{playerId:string;name:string;bats:'R'|'L';heightMeters:number;courseProfile?:BatterCourseProfileV79}>;
export type LiveGameStatisticsV79=Readonly<{version:'local_course_game_v79';gameId:string;seed:number;players:readonly LiveGamePlayerV79[];
  records:readonly LivePitchSummaryV79[];finished:boolean;nativeAdmission:false}>;

function decision(classification:string,ended:boolean,f:LiveScoringFactsV79):LiveScoringDecisionV79{
  const known=(ab:number,h:number,hr:number,reason:string):LiveScoringDecisionV79=>({status:'confirmed',ab,h,hr,reason});
  const pending=(reason:string):LiveScoringDecisionV79=>({status:'pending',ab:null,h:null,hr:null,reason});
  if(!ended)return {status:'in_progress',ab:null,h:null,hr:null,reason:'plate_appearance_continues'};
  if(classification==='walk')return known(0,0,0,'base_on_balls');
  if(classification==='strikeout')return known(1,0,0,'strikeout');
  if(classification==='home_run')return known(1,1,1,'rules_confirmed_home_run');
  if(classification==='ground_rule_double')return f.hasFieldFacts&&f.firstDefensiveTouchTick===null&&f.firstThrowTick===null
    ?known(1,1,0,'untouched_batted_ground_rule_award'):pending('hit_error_judgment_missing');
  if(['fly_out','foul_out'].includes(classification)){
    if(f.runsScored>0&&f.priorRunnerCount>0&&f.outsAtStart<2)return pending('sacrifice_fly_judgment_missing');
    return known(1,0,0,'caught_out');
  }
  if(classification!=='live_ball')return pending('unsupported_terminal_classification');
  if(f.bunt&&f.priorRunnerCount>0&&f.outsAtStart<2)return pending('sacrifice_bunt_judgment_missing');
  if(f.batterOutBeforeFirst)return known(1,0,0,'batter_retired_before_first');
  if(f.otherForceOutBeforeFirst)return known(1,0,0,'fielders_choice_force');
  if(f.otherForceChoiceBeforeFirst)return pending('fielders_choice_or_hit_judgment_missing');
  // Reaching a base alone does not distinguish H/E/FC. An untouched ball
  // reaches first before any defensive touch/throw is a narrow positive case.
  if(f.hasFieldFacts&&f.batterFirstTouchTick!==null
    &&(f.firstDefensiveTouchTick===null||f.batterFirstTouchTick<f.firstDefensiveTouchTick)
    &&(f.firstThrowTick===null||f.batterFirstTouchTick<f.firstThrowTick))return known(1,1,0,'first_base_before_defensive_play');
  if(f.hasFieldFacts&&f.batterFirstTouchTick!==null&&f.cleanFieldEvidence&&!f.fieldingFailureBeforeFirst&&!f.caught)
    return known(1,1,0,'clean_completed_field_play_hit');
  return pending('hit_error_choice_judgment_missing');
}
function spray(velocity:LivePitchSummaryV79['spray']['velocity'],classification:string){
  const foul=['foul','foul_out'].includes(classification),angle=velocity?Math.atan2(velocity.x,velocity.z)*180/Math.PI:null;
  const fair=angle!==null&&!foul&&Math.hypot(velocity!.x,velocity!.z)>0&&angle>=-45-1e-10&&angle<=45+1e-10;
  const directionIndex=fair?angle!<-27-1e-10?0:angle!<-9-1e-10?1:angle!<9-1e-10?2:angle!<27-1e-10?3:4:null;
  return {velocity,directionIndex,foul,homeRun:classification==='home_run'};
}
function observeCourse(record:LiveIssuedPitchV1):LiveCourseObservationV79{
  const missing:LiveCourseObservationV79={position:null,planeZ:.15,provenance:'missing_source',sourceOriginTick:null,crossingElapsedSeconds:null};
  const descriptor=(record.play.diagnostics as {sourceDescriptor?:SourceFreeBallDescriptorV2}|null)?.sourceDescriptor;
  if(!descriptor)return missing;
  // Clone only the Source descriptor, never the Host's history or frame graph.
  const kernel=createSourceFreeBallKernel(descriptor),from=kernel.descriptor.initial.elapsedSeconds,through=kernel.descriptor.throughElapsedSeconds;
  if(kernel.evaluateAt(from).moment.ball.position.z<.15||kernel.evaluateAt(through).moment.ball.position.z>.15)return missing;
  let lo=from,hi=through;
  for(let i=0;i<60&&hi-lo>1e-12;i++){
    const mid=(lo+hi)/2;if(kernel.evaluateAt(mid).moment.ball.position.z>.15)lo=mid;else hi=mid;
  }
  const at=kernel.evaluateAt(hi).moment.ball.position,contact=record.play.contactMoment;
  return {position:{x:at.x,y:at.y},planeZ:.15,
    provenance:contact&&contact.elapsedSeconds<hi?'source_estimated_after_front_contact':'source_plate_crossing',
    sourceOriginTick:descriptor.initial.originTick,crossingElapsedSeconds:hi};
}

/** Trusted Live Host output -> bounded local record. This grants no Native admission. */
export function summarizeLiveIssuedPitchV79(record:LiveIssuedPitchV1):LivePitchSummaryV79{
  const rules=record.play.rules;if(rules.kind!=='applied')return fail('applied rules required');
  const field=record.play.field,first=field?.ruleFacts.runnerTouches.find(t=>t.runnerId===record.batterPlayerId&&t.base===1)?.tick??null;
  const origin=record.play.contactMoment?.originTick??0,tps=(record.play.diagnostics as {sourceClockTicksPerSecond?:number}).sourceClockTicksPerSecond??1_000_000,
    beforeFirst=(seconds:number)=>first!==null&&origin+Math.round(seconds*tps)<=first,
    diagnostic=field?.diagnostics,contacts=diagnostic?.aiTelemetry?.contactDiagnostics,throws=diagnostic?.throwDirectionCommands,
    cancellations=diagnostic?.aiTelemetry?.throwTargetCancellations;
  const cleanFieldEvidence=!!field?.end?.complete&&diagnostic?.unresolvedDetail===null&&Array.isArray(contacts)&&Array.isArray(throws)&&Array.isArray(cancellations);
  const firstThrow=minimumThrow(field),failure=!!field?.facts.some(f=>f.tick<=(first??-1)&&(f.kind==='body_contact'
    ||f.kind==='ground_contact'&&firstThrow!==null&&f.tick>firstThrow))
    ||!!contacts?.some(c=>beforeFirst(c.elapsedSeconds)&&(c.role==='body'||c.retention?.outcome!=='secured'))
    ||!!throws?.some(t=>beforeFirst(t.elapsedSeconds)&&(t.actual.yawRadians!==0||t.actual.pitchRadians!==0))
    ||!!cancellations?.some(c=>beforeFirst(c.elapsedSeconds)&&c.releasedAt!==null);
  const minimum=(kind:readonly string[])=>{const ticks=field?.facts.filter(f=>kind.includes(f.kind)).map(f=>f.tick)??[];return ticks.length?Math.min(...ticks):null;};
  const facts:LiveScoringFactsV79={outsAtStart:record.beforeMatch.outs,priorRunnerCount:Object.values(record.beforeMatch.bases).filter(Boolean).length,
    runsScored:rules.scoredRunnerIds.length,bunt:record.command.batting==='bunt',hasFieldFacts:!!field,
    firstDefensiveTouchTick:minimum(['glove_contact','body_contact','catch_secured']),firstThrowTick:minimum(['throw_release']),batterFirstTouchTick:first,
    batterOutBeforeFirst:rules.outcomes.some(o=>o.runnerId===record.batterPlayerId&&o.classification==='batter_runner_before_first'),
    otherForceOutBeforeFirst:rules.outcomes.some(o=>o.runnerId!==record.batterPlayerId&&o.classification==='force'&&(first===null||o.tick<=first)),
    caught:!!field?.ruleFacts.flyCatch,cleanFieldEvidence,fieldingFailureBeforeFirst:failure,
    otherForceChoiceBeforeFirst:!!field?.facts.some(f=>f.kind==='throw_release'&&f.reason==='force_play'&&f.runnerId!==record.batterPlayerId&&f.tick<=(first??Infinity))};
  const velocity=record.play.outgoingBallMoment?.ball.velocity??null,ended=rules.batterAdvanced;
  return cloneInert({version:'live_pitch_summary_v79',scoringPolicy:'local_physical_scoring_v79_1',pitchId:`${record.beforeMatch.playId}:${rules.endedAtTick}`,
    plateAppearanceId:String(record.beforeMatch.playId),batterPlayerId:record.batterPlayerId,pitcherPlayerId:record.pitcherPlayerId,
    before:record.beforeMatch,after:record.match,endedAtTick:rules.endedAtTick,classification:rules.classification,ended,gameOver:rules.gameOver,
    scoring:decision(rules.classification,ended,facts),facts,course:observeCourse(record),spray:spray(velocity,rules.classification)});
}
function minimumThrow(field:LiveIssuedPitchV1['play']['field']){
  const throws=field?.facts.filter(f=>f.kind==='throw_release').map(f=>f.tick)??[];return throws.length?Math.min(...throws):null;
}
function checkState(m:CanonicalMatchState,gameOver=false){
  assert(m&&id(m.ruleProfileId)&&count(m.inning)&&m.inning>=1&&['top','bottom'].includes(m.half)&&count(m.playId),'invalid match identity');
  assert([m.outs,m.balls,m.strikes].every(count)&&m.outs<=(gameOver?3:2)&&m.balls<=3&&m.strikes<=2,'invalid match count');
  assert(m.bases&&Object.keys(m.bases).sort().join(',')==='first,second,third'&&Object.values(m.bases).every(v=>v===null||id(v)),'invalid runners');
  assert(m.score&&count(m.score.away)&&count(m.score.home),'invalid score');
}
function same(a:unknown,b:unknown):boolean{
  if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>,keys=Object.keys(aa).sort(),other=Object.keys(bb).sort();
  return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&same(aa[key],bb[key]));
}
function fields(raw:unknown,required:readonly string[],optional:readonly string[]=[]){
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&(Object.getPrototypeOf(raw)===Object.prototype||Object.getPrototypeOf(raw)===null),'inert object required');
  const d=Object.getOwnPropertyDescriptors(raw);assert(required.every(k=>d[k]?.enumerable&&'value' in d[k])
    &&Reflect.ownKeys(raw as object).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&d[k].enumerable&&'value' in d[k]),'unknown/missing or accessor fields');
}
function dense(raw:unknown,max:number){
  assert(Array.isArray(raw)&&raw.length<=max&&Reflect.ownKeys(raw).length===raw.length+1,'bounded dense array required');
  if(Array.isArray(raw))for(let i=0;i<raw.length;i++){const d=Object.getOwnPropertyDescriptor(raw,String(i));assert(d&&d.enumerable&&'value' in d,'inert dense array required');}
}
function checkRecord(raw:LivePitchSummaryV79,players:ReadonlyMap<string,LiveGamePlayerV79>):LivePitchSummaryV79{
  fields(raw,['version','scoringPolicy','pitchId','plateAppearanceId','batterPlayerId','pitcherPlayerId','before','after','endedAtTick','classification','ended','gameOver','scoring','facts','course','spray']);
  const r=cloneInert(raw);assert(r?.version==='live_pitch_summary_v79'&&r.scoringPolicy==='local_physical_scoring_v79_1'&&id(r.pitchId)&&id(r.plateAppearanceId),'invalid pitch identity');
  assert(players.has(r.batterPlayerId)&&players.has(r.pitcherPlayerId)&&r.batterPlayerId!==r.pitcherPlayerId,'unknown pitch player');
  checkState(r.before);checkState(r.after,r.gameOver);
  assert(count(r.endedAtTick)&&typeof r.ended==='boolean'&&typeof r.gameOver==='boolean'&&(!r.gameOver||r.ended)
    &&['count','foul','walk','strikeout','live_ball','home_run','ground_rule_double','fly_out','foul_out'].includes(r.classification)
    &&r.ended!==['count','foul'].includes(r.classification)&&r.plateAppearanceId===String(r.before.playId)
    &&r.pitchId===`${r.before.playId}:${r.endedAtTick}`&&r.after.playId===r.before.playId+(r.ended?1:0),'pitch clock/order differs');
  const f=r.facts;assert(f&&[f.outsAtStart,f.priorRunnerCount,f.runsScored].every(count)&&f.outsAtStart===r.before.outs&&f.priorRunnerCount<=3&&f.runsScored<=4
    &&f.priorRunnerCount===Object.values(r.before.bases).filter(Boolean).length,'invalid scoring facts');
  fields(f,['outsAtStart','priorRunnerCount','runsScored','bunt','hasFieldFacts','firstDefensiveTouchTick','firstThrowTick','batterFirstTouchTick','batterOutBeforeFirst','otherForceOutBeforeFirst','caught','cleanFieldEvidence','fieldingFailureBeforeFirst','otherForceChoiceBeforeFirst']);
  assert(['bunt','hasFieldFacts','batterOutBeforeFirst','otherForceOutBeforeFirst','caught','cleanFieldEvidence','fieldingFailureBeforeFirst','otherForceChoiceBeforeFirst'].every(k=>typeof f[k as keyof typeof f]==='boolean')
    &&[f.firstDefensiveTouchTick,f.firstThrowTick,f.batterFirstTouchTick].every(nullableTick),'invalid physical scoring facts');
  assert([f.firstDefensiveTouchTick,f.firstThrowTick,f.batterFirstTouchTick].every(t=>t===null||t<=r.endedAtTick),'future scoring fact');
  assert(same(r.scoring,decision(r.classification,r.ended,f)),'scoring evidence differs');
  const c=r.course;assert(c&&c.planeZ===.15&&['source_plate_crossing','source_estimated_after_front_contact','missing_source'].includes(c.provenance),'invalid course provenance');
  fields(c,['position','planeZ','provenance','sourceOriginTick','crossingElapsedSeconds'],['zone','courseId','courseIndex','publicZoneId']);
  assert(c.position===null?c.provenance==='missing_source'&&c.sourceOriginTick===null&&c.crossingElapsedSeconds===null
    :Number.isFinite(c.position.x)&&Number.isFinite(c.position.y)&&c.provenance!=='missing_source'&&count(c.sourceOriginTick)
      &&Number.isFinite(c.crossingElapsedSeconds)&&Number(c.crossingElapsedSeconds)>=0,'invalid course position');
  const v=r.spray.velocity;assert(v===null||v&&[v.x,v.y,v.z].every(Number.isFinite),'invalid outgoing velocity');
  assert(same(r.spray,spray(v,r.classification)),'spray evidence differs');
  const p=players.get(r.batterPlayerId)!,z=resolveHeightRatioStrikeZoneRegion({plateCenterX:0,playerPhysicalProfile:{heightMeters:p.heightMeters}}),
    zone={centerX:0,halfWidth:z.halfWidth,lowerY:z.lowerY,upperY:z.upperY},category=c.position?classifyBatterCourseV79({position:c.position,zone}):null;
  const course={...c,zone,courseId:category?.courseId??null,courseIndex:category?.courseIndex??null,publicZoneId:category?.publicZoneId??null};
  if(['zone','courseId','courseIndex','publicZoneId'].some(key=>Object.hasOwn(c,key)))assert(same(c,course),'course classification differs');
  return {...r,course};
}

export function createLiveGameStatisticsV79(input:Readonly<{gameId:string;seed:number;players:readonly LivePlayerV1[];records:readonly LivePitchSummaryV79[];finished:boolean}>):LiveGameStatisticsV79{
  assert(id(input.gameId)&&Number.isSafeInteger(input.seed)&&input.seed>=0&&input.seed<=0xffffffff&&typeof input.finished==='boolean','invalid game identity');
  assert(Array.isArray(input.players)&&input.players.length>=2&&input.players.length<=100&&Array.isArray(input.records)&&input.records.length<=3000,'bounded game data required');
  const players=input.players.map(raw=>{
    // Explicit projection avoids cloning abilities, measured clips or unrelated rosters.
    const candidate=raw as LivePlayerV1&{courseProfile?:BatterCourseProfileV79};
    const profile=candidate.courseProfile??raw.physical?.batterCourseProfileV79;
    const p:LiveGamePlayerV79=cloneInert({playerId:raw.playerId,name:raw.name,bats:raw.bats,heightMeters:raw.heightMeters,...(profile===undefined?{}:{courseProfile:validateBatterCourseProfileV79(profile)})});
    assert(id(p.playerId)&&id(p.name)&&['R','L'].includes(p.bats)&&Number.isFinite(p.heightMeters)&&p.heightMeters>=1.1&&p.heightMeters<=2.5,'invalid game player');return p;
  });
  assert(new Set(players.map(p=>p.playerId)).size===players.length,'duplicate game player');
  const map=new Map(players.map(p=>[p.playerId,p])),records=input.records.map(r=>checkRecord(r,map)),seen=new Set<string>();
  for(let i=0;i<records.length;i++){
    const r=records[i];assert(!seen.has(r.pitchId),'duplicate pitch');seen.add(r.pitchId);
    if(i){const previous=records[i-1];assert(!previous.gameOver&&same(previous.after,r.before)&&r.endedAtTick>previous.endedAtTick,'game record sequence differs');
      if(!previous.ended)assert(previous.batterPlayerId===r.batterPlayerId&&previous.pitcherPlayerId===r.pitcherPlayerId,'plate appearance player differs');}
  }
  if(input.finished)assert(records.length>0&&records.at(-1)!.ended&&records.at(-1)!.gameOver,'finished game has incomplete plate appearance');
  return {version:'local_course_game_v79',gameId:input.gameId,seed:input.seed,players,records,finished:input.finished,nativeAdmission:false};
}

export function validateLiveGameStatisticsV79(raw:unknown):LiveGameStatisticsV79{
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw),'game object required');
  fields(raw,['finished','gameId','nativeAdmission','players','records','seed','version']);
  const r=raw as LiveGameStatisticsV79;assert(r.version==='local_course_game_v79'&&r.nativeAdmission===false,'local game version required');
  dense(r.players,100);dense(r.records,3000);
  const players=r.players.map(p=>{fields(p,['playerId','name','bats','heightMeters'],['courseProfile']);return cloneInert(p);});
  const checked=createLiveGameStatisticsV79({...r,players});assert(same(checked,r),'imported game differs from canonical local projection');return checked;
}
