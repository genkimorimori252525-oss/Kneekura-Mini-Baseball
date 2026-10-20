import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createNeutralBatterCourseProfileV79,validateBatterCourseProfileV79,type BatterCourseProfileV79 } from './BatterCourseProfileV79';
import { validateLiveGameStatisticsV79,type LiveGameStatisticsV79,type LivePitchSummaryV79 } from './LiveCourseScoringV79';

/** Authored local adaptation policy; these constants are not measured calibration. */
export const LIVE_COURSE_LEARNING_POLICY_V79=Object.freeze({version:'local_course_learning_v79_1' as const,
  seasonPriorK:40,longTermPriorK:200,seasonStrength:.15,seasonGameLimit:.04,practiceStrength:.02,practicePriorAttempts:100,
  practiceLimit:.03,combinedSeasonLimit:.06,longTermRate:.05,longTermSeasonLimit:.005});
export type LiveCoursePracticeV79=Readonly<{practiceId:string;seasonId:string;playerId:string;courseId:number;attempts:number;quality:number}>;
export type LiveSeasonV79=Readonly<{seasonId:string;name:string;status:'open'|'closed';games:readonly LiveGameStatisticsV79[];practices:readonly LiveCoursePracticeV79[]}>;
export type LiveLongTermCourseV79=Readonly<{playerId:string;deltas:readonly number[]}>;
export type LiveSeasonStoreV79=Readonly<{version:'live_seasons_v79';policyVersion:'local_course_learning_v79_1';selectedSeasonId:string|null;
  seasons:readonly LiveSeasonV79[];longTerm:readonly LiveLongTermCourseV79[]}>;
export type LiveSeasonCommandV79=Readonly<{kind:'create';seasonId:string;name:string}>|Readonly<{kind:'select';seasonId:string|null}>
  |Readonly<{kind:'record_game';seasonId:string;game:LiveGameStatisticsV79}>
  |Readonly<{kind:'practice';practiceId:string;seasonId:string;playerId:string;courseId:number;attempts:number;quality:number}>
  |Readonly<{kind:'close';seasonId:string}>;
export type LiveCourseTallyV79=Readonly<{publicZoneId?:number;ab:number;h:number;hr:number;pending:number;plateAppearances:number;
  average:number|null;knownAverage:number|null;color:'red'|'blue'|'gray';complete:boolean}>;
const fail=(message:string):never=>{throw Error('live season v79: '+message);};
function assert(value:unknown,message:string):asserts value {if(!value)fail(message);}
const id=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=160&&s===s.trim();
const finite=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const cap=(v:number,limit:number)=>Math.max(-limit,Math.min(limit,v));
const boundedAverage=(v:number)=>Math.max(0,Math.min(1,v));
const sum=(a:number,b:number)=>{const n=a+b;assert(Number.isSafeInteger(n),'count overflow');return n;};
function object(raw:unknown,keys:readonly string[]):asserts raw is Record<string,unknown>{
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&(Object.getPrototypeOf(raw)===Object.prototype||Object.getPrototypeOf(raw)===null),'inert object required');
  const descriptors=Object.getOwnPropertyDescriptors(raw);assert(Reflect.ownKeys(raw).length===keys.length&&keys.every(k=>descriptors[k]?.enumerable&&'value' in descriptors[k]),'unknown/missing or accessor fields');
}
function array(raw:unknown,max:number):asserts raw is unknown[]{
  assert(Array.isArray(raw)&&raw.length<=max&&Reflect.ownKeys(raw).length===raw.length+1,'bounded dense array required');
  for(let i=0;i<raw.length;i++){const d=Object.getOwnPropertyDescriptor(raw,String(i));assert(d&&d.enumerable&&'value' in d,'inert array required');}
}
const courseIndex=(courseId:number)=>{const column=Math.floor(courseId/10),row=courseId%10;assert(Number.isInteger(courseId)&&column>=1&&column<=9&&row>=0&&row<=6,'invalid 63 course ID');return (column-1)*7+row;};
export function createLiveSeasonStoreV79():LiveSeasonStoreV79{return {version:'live_seasons_v79',policyVersion:'local_course_learning_v79_1',selectedSeasonId:null,seasons:[],longTerm:[]};}

function learningCounts(season:LiveSeasonV79,playerId:string){
  const counts=Array.from({length:63},()=>({ab:0,h:0}));
  for(const game of season.games)for(const r of game.records){
    const i=r.course.courseIndex;if(r.batterPlayerId!==playerId||!r.ended||r.scoring.status!=='confirmed'||i===undefined||i===null)continue;
    counts[i].ab=sum(counts[i].ab,r.scoring.ab!);counts[i].h=sum(counts[i].h,r.scoring.h!);
  }
  return counts;
}
function learnClosedSeason(season:LiveSeasonV79,prior:readonly LiveLongTermCourseV79[]):LiveLongTermCourseV79[]{
  const p=LIVE_COURSE_LEARNING_POLICY_V79,map=new Map(prior.map(entry=>[entry.playerId,[...entry.deltas]]));
  const players=new Set(season.games.flatMap(g=>g.records.filter(r=>r.ended&&r.scoring.status==='confirmed'&&r.scoring.ab!>0).map(r=>r.batterPlayerId)));
  for(const playerId of players){
    const tally=learningCounts(season,playerId),deltas=map.get(playerId)??Array(63).fill(0);
    // Game players retain the authored baseline; the Host uses a separate
    // effective execution snapshot. Only this closed season's delta is added.
    const baseline=season.games.find(g=>g.players.some(player=>player.playerId===playerId))?.players.find(player=>player.playerId===playerId)?.courseProfile??createNeutralBatterCourseProfileV79();
    for(let i=0;i<63;i++)if(tally[i].ab>0){
      const {ab,h}=tally[i],reference=boundedAverage(baseline.referenceAverages[i]+deltas[i]),evaluation=(h+p.longTermPriorK*reference)/(ab+p.longTermPriorK),
        eta=p.longTermRate*ab/(ab+p.longTermPriorK),delta=cap(eta*(evaluation-reference),p.longTermSeasonLimit);
      deltas[i]+=delta;assert(Number.isFinite(deltas[i])&&Math.abs(deltas[i])<=1,'long-term difference overflow');
    }
    map.set(playerId,deltas);
  }
  return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([playerId,deltas])=>({playerId,deltas}));
}
function validatePractice(raw:unknown):LiveCoursePracticeV79{
  object(raw,['practiceId','seasonId','playerId','courseId','attempts','quality']);
  const r=cloneInert(raw) as unknown as LiveCoursePracticeV79;
  assert(id(r.practiceId)&&id(r.seasonId)&&id(r.playerId),'invalid practice identity');courseIndex(r.courseId);
  assert(Number.isSafeInteger(r.attempts)&&r.attempts>0&&r.attempts<=1_000_000&&finite(r.quality,0,1),'invalid practice quantity');return r;
}
export function validateLiveSeasonStoreV79(raw:unknown):LiveSeasonStoreV79{
  object(raw,['version','policyVersion','selectedSeasonId','seasons','longTerm']);
  assert(raw.version==='live_seasons_v79'&&raw.policyVersion==='local_course_learning_v79_1','unsupported local season policy');
  assert(raw.selectedSeasonId===null||id(raw.selectedSeasonId),'invalid selected season');array(raw.seasons,64);array(raw.longTerm,1000);
  const seasonIds=new Set<string>(),gameIds=new Set<string>(),practiceIds=new Set<string>();let totalPitches=0;
  const seasons=raw.seasons.map(source=>{
    object(source,['seasonId','name','status','games','practices']);
    assert(id(source.seasonId)&&id(source.name)&&['open','closed'].includes(String(source.status))&&!seasonIds.has(source.seasonId),'invalid/duplicate season');seasonIds.add(source.seasonId);
    array(source.games,512);array(source.practices,8192);
    const games=source.games.map(g=>{
      const game=validateLiveGameStatisticsV79(g);assert(game.finished&&!gameIds.has(game.gameId),'finished unique season game required');gameIds.add(game.gameId);
      totalPitches+=game.records.length;assert(totalPitches<=100000,'season pitch budget exceeded');return game;
    });
    const practices=source.practices.map(p=>{const practice=validatePractice(p);assert(practice.seasonId===source.seasonId&&!practiceIds.has(practice.practiceId),'practice season/identity differs');practiceIds.add(practice.practiceId);return practice;});
    return {seasonId:source.seasonId,name:source.name,status:source.status as 'open'|'closed',games,practices};
  });
  assert(raw.selectedSeasonId===null||seasonIds.has(raw.selectedSeasonId),'unknown selected season');
  let expected:LiveLongTermCourseV79[]=[],openSeen=false;
  for(const season of seasons)if(season.status==='closed'){assert(!openSeen,'closed season order differs');expected=learnClosedSeason(season,expected);}else openSeen=true;
  const longTerm=raw.longTerm.map(entry=>{
    object(entry,['playerId','deltas']);assert(id(entry.playerId),'invalid long-term player');array(entry.deltas,63);
    assert(entry.deltas.length===63&&entry.deltas.every(d=>finite(d,-1,1)),'63 finite long-term differences required');return cloneInert(entry) as unknown as LiveLongTermCourseV79;
  });
  assert(longTerm.length===expected.length&&longTerm.every((entry,i)=>entry.playerId===expected[i].playerId&&entry.deltas.every((delta,j)=>delta===expected[i].deltas[j])),'long-term evidence differs from closed seasons');
  return {version:'live_seasons_v79',policyVersion:'local_course_learning_v79_1',selectedSeasonId:raw.selectedSeasonId,seasons,longTerm};
}
export function reduceLiveSeasonStoreV79(input:Readonly<{store:LiveSeasonStoreV79;command:LiveSeasonCommandV79}>):LiveSeasonStoreV79{
  const store=validateLiveSeasonStoreV79(input.store),descriptors=Object.getOwnPropertyDescriptors(input.command);
  assert(descriptors.kind&&'value' in descriptors.kind&&Object.values(descriptors).every(d=>d.enumerable&&'value' in d),'inert command required');
  // A finished game can exceed one inert-node budget; validate its bounded
  // record projections independently, exactly as on JSON import.
  const c=input.command.kind==='record_game'?{...input.command}:cloneInert(input.command);
  assert(c&&['create','select','record_game','practice','close'].includes(c.kind),'invalid season command');
  if(c.kind==='create'){
    object(c,['kind','seasonId','name']);assert(id(c.seasonId)&&id(c.name)&&!store.seasons.some(s=>s.seasonId===c.seasonId),'unique season identity required');
    assert(store.seasons.length<64,'season budget exceeded');
    return {...store,selectedSeasonId:c.seasonId,seasons:[...store.seasons,{seasonId:c.seasonId,name:c.name,status:'open',games:[],practices:[]}]};
  }
  if(c.kind==='select'){
    object(c,['kind','seasonId']);assert(c.seasonId===null||store.seasons.some(s=>s.seasonId===c.seasonId),'unknown season');return {...store,selectedSeasonId:c.seasonId};
  }
  const index=store.seasons.findIndex(s=>s.seasonId===c.seasonId);assert(index>=0,'unknown season');const season=store.seasons[index];assert(season.status==='open','season already closed');
  let replacement:LiveSeasonV79,longTerm=store.longTerm;
  if(c.kind==='record_game'){
    object(c,['kind','seasonId','game']);const game=validateLiveGameStatisticsV79(c.game);
    assert(game.finished&&!store.seasons.some(s=>s.games.some(g=>g.gameId===game.gameId)),'finished unique game required');assert(season.games.length<512,'game budget exceeded');
    replacement={...season,games:[...season.games,game]};
  }else if(c.kind==='practice'){
    object(c,['kind','practiceId','seasonId','playerId','courseId','attempts','quality']);
    const {kind,...data}=c;void kind;const practice=validatePractice(data);
    assert(!store.seasons.some(s=>s.practices.some(p=>p.practiceId===practice.practiceId)),'duplicate practice');assert(season.practices.length<8192,'practice budget exceeded');
    replacement={...season,practices:[...season.practices,practice]};
  }else{
    object(c,['kind','seasonId']);assert(!store.seasons.slice(index+1).some(s=>s.status==='closed'),'season close order differs');
    assert(store.seasons.slice(0,index).every(s=>s.status==='closed'),'close preceding seasons first');
    replacement={...season,status:'closed'};longTerm=learnClosedSeason(season,store.longTerm);
  }
  const seasons=store.seasons.map((s,i)=>i===index?replacement:s),result={...store,seasons,longTerm};
  // Enforce aggregate budgets before returning, without cloning a frame/history graph.
  assert(seasons.reduce((n,s)=>n+s.games.reduce((m,g)=>m+g.records.length,0),0)<=100000,'season pitch budget exceeded');return result;
}
function emptyTally(){return {ab:0,h:0,hr:0,pending:0,plateAppearances:0};}
function finishTally(t:ReturnType<typeof emptyTally>):LiveCourseTallyV79{
  const knownAverage=t.ab?t.h/t.ab:null,average=t.pending?null:knownAverage;
  return {...t,average,knownAverage,color:average===null?'gray':average>=.3?'red':average<=.2?'blue':'gray',complete:t.pending===0};
}
export function getLiveSeasonReportV79(input:Readonly<{store:LiveSeasonStoreV79;seasonId:string;playerId:string}>){
  const store=validateLiveSeasonStoreV79(input.store),season=store.seasons.find(s=>s.seasonId===input.seasonId);assert(season&&id(input.playerId),'season/player required');
  const inside=Array.from({length:9},emptyTally),outside=emptyTally(),offGrid=emptyTally(),missing=emptyTally(),totals=emptyTally(),counts=[0,0,0,0,0],homeRuns=[0,0,0,0,0];let fouls=0;
  const add=(t:ReturnType<typeof emptyTally>,r:LivePitchSummaryV79)=>{
    t.plateAppearances=sum(t.plateAppearances,1);if(r.scoring.status!=='confirmed'){t.pending=sum(t.pending,1);return;}
    t.ab=sum(t.ab,r.scoring.ab!);t.h=sum(t.h,r.scoring.h!);t.hr=sum(t.hr,r.scoring.hr!);
  };
  for(const game of season.games)for(const r of game.records)if(r.batterPlayerId===input.playerId){
    if(r.spray.foul)fouls=sum(fouls,1);else if(r.spray.directionIndex!==null){const i=r.spray.directionIndex;counts[i]=sum(counts[i],1);if(r.spray.homeRun)homeRuns[i]=sum(homeRuns[i],1);}
    if(!r.ended)continue;add(totals,r);
    if(r.course.position===null)add(missing,r);else if(r.course.courseId===null)add(offGrid,r);
    else if(r.course.publicZoneId!==null&&r.course.publicZoneId!==undefined)add(inside[r.course.publicZoneId-1],r);else add(outside,r);
  }
  const total=counts.reduce(sum,0);return {seasonId:season.seasonId,playerId:input.playerId,status:season.status,
    inside:inside.map((t,i)=>({...finishTally(t),publicZoneId:i+1})),outside:finishTally(outside),offGrid:finishTally(offGrid),missing:finishTally(missing),totals:finishTally(totals),
    spray:{counts,ratios:counts.map(n=>total?n/total:null),homeRuns,total,fouls},policyVersion:store.policyVersion,nativeAdmission:false as const};
}
export function deriveLiveCourseProfileV79(input:Readonly<{store:LiveSeasonStoreV79;seasonId:string;playerId:string;profile?:BatterCourseProfileV79}>):BatterCourseProfileV79{
  const store=validateLiveSeasonStoreV79(input.store),index=store.seasons.findIndex(s=>s.seasonId===input.seasonId);assert(index>=0&&id(input.playerId),'season/player required');
  const baseline=input.profile===undefined?createNeutralBatterCourseProfileV79():validateBatterCourseProfileV79(input.profile),season=store.seasons[index],p=LIVE_COURSE_LEARNING_POLICY_V79;
  let prior:LiveLongTermCourseV79[]=[];for(let i=0;i<index;i++)if(store.seasons[i].status==='closed')prior=learnClosedSeason(store.seasons[i],prior);
  const longTerm=prior.find(entry=>entry.playerId===input.playerId)?.deltas??Array(63).fill(0),tally=learningCounts(season,input.playerId),practiceAttempts=Array(63).fill(0),practiceWeighted=Array(63).fill(0);
  for(const practice of season.practices)if(practice.playerId===input.playerId){const i=courseIndex(practice.courseId);practiceAttempts[i]=sum(practiceAttempts[i],practice.attempts);practiceWeighted[i]+=(2*practice.quality-1)*practice.attempts;assert(Number.isFinite(practiceWeighted[i]),'practice accumulation overflow');}
  const referenceAverages=baseline.referenceAverages.map((authored,i)=>{
    const reference=boundedAverage(authored+longTerm[i]),{ab,h}=tally[i],evaluated=(h+p.seasonPriorK*reference)/(ab+p.seasonPriorK),
      gameDelta=ab?cap(p.seasonStrength*(evaluated-reference),p.seasonGameLimit):0,
      practiceDelta=cap(p.practiceStrength*practiceWeighted[i]/(practiceAttempts[i]+p.practicePriorAttempts),p.practiceLimit);
    return boundedAverage(reference+cap(gameDelta+practiceDelta,p.combinedSeasonLimit));
  });
  return validateBatterCourseProfileV79({...baseline,referenceAverages});
}
