import type {CanonicalMatchState} from '../../core/model/CanonicalMatchState';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from '../../core/sim/fielding/LiveFieldPlayV1';
import {estimateLiveDefenseControlV95} from '../../core/sim/fielding/LiveDefenseControlEstimateV95';
import {reducePlayableMatchV1,type PlayableMatchRuleResultV1} from './PlayableMatchRulesV1';
import {classifyLocalScoringV100,type LocalScoringCandidateV100,type LocalScoringEvidenceV100} from './LiveMatchScoringV100';

type Field=ReturnType<typeof simulateLiveFieldPlayV1>;
type Request={before:CanonicalMatchState;batterRunnerId:string;bunt:boolean;rules:Extract<PlayableMatchRuleResultV1,{kind:'applied'}>;
 input:LiveFieldPlayInputV1|null;field:Field|null;regulationInnings:number};
/** Local recordkeeper only. One bounded reference simulation on suspected
 * physical misplays; never substitutes its facts into the actual match.
 * Neutral SI values are provisional ordinary-effort policy, not MLB means. */
export function scoreLivePlayV100(r:Request){
 const end=r.rules.endedAtTick,field=r.field,input=r.input,tps=input?.physics.air.ticksPerSecond??1_000_000,
  origin=input?.ball.originTick??0,toTick=(s:number)=>origin+Math.round(s*tps),
  initialBases:Record<string,number>={[r.batterRunnerId]:0};
 (['first','second','third'] as const).forEach((key,i)=>{const id=r.before.bases[key];if(id)initialBases[id]=i+1;});
 const e:LocalScoringEvidenceV100={playId:r.before.playId,batterRunnerId:r.batterRunnerId,endedAtTick:end,ended:r.rules.batterAdvanced,
  classification:r.rules.classification,outsBefore:r.before.outs,bunt:r.bunt,initialBases,
  touches:(field?.ruleFacts.runnerTouches??[]).filter(t=>t.tick<=end).map(t=>({runnerId:t.runnerId,base:t.base,tick:t.tick})),
  outs:r.rules.outcomes.map(o=>({runnerId:o.runnerId,tick:o.tick,classification:o.classification})),scoredRunnerIds:[...r.rules.scoredRunnerIds],
  firstChoice:null,candidates:[],ordinary:{available:true,outRunnerIds:[],furthestBases:{...initialBases},flyCaught:false,scoredRunnerIds:[]}};
 if(!field||!input)return classifyLocalScoringV100(e);
 const {facts,releases,candidates}=collectLiveErrorCandidatesV100(field,end,toTick);e.candidates=candidates;
 const choice=releases.find(f=>f.runnerId&&f.runnerId!==r.batterRunnerId),first=e.touches.find(t=>t.runnerId===r.batterRunnerId&&t.base===1);
 const originalHandler=facts.find(f=>['glove_contact','body_contact','catch_secured'].includes(f.kind))?.playerId,
  initialInfielder=input.fielders.some(f=>f.playerId===originalHandler&&!!f.defensivePosition&&!['LF','CF','RF'].includes(f.defensivePosition)),
  oneBaseAttempt=(id:string,at:number)=>!e.touches.some(t=>t.runnerId===id&&t.tick<at&&t.base>(initialBases[id]??0));
 if(choice){
  const snapshot=field.frames.filter(f=>f.tick<=choice.tick).at(-1),holder=input.fielders.find(f=>f.playerId===choice.playerId);
  let possible:boolean|null=null;
  if(first&&first.tick<=choice.tick)possible=false;
  else if(snapshot&&holder){
   const actors=snapshot.fielders.map(f=>{const spec=input.fielders.find(s=>s.playerId===f.playerId)!;return{...spec,homePosition:spec.position,
    ...f,glovePosition:f.glove,gloveVelocity:f.velocity,remainingReactionSeconds:0};});
   const estimate=estimateLiveDefenseControlV95({observedAtSeconds:snapshot.elapsedSeconds,nowSeconds:snapshot.elapsedSeconds,snapshotKey:`score:${choice.tick}`,
    actors,sources:[{playerId:holder.playerId,point:choice.position!,readySeconds:0,kind:'held',holderTransferRemainingSeconds:0}],
    target:{base:1,position:{...input.field.bases.first,y:.9},forced:true},physics:input.physics,...(input.orientation?{materialOrientation:input.orientation}:{}),
    limits:{maximumRelays:0,maximumAeroSolves:2}});
   if(estimate.kind==='estimated'&&first)possible=choice.tick+Math.ceil(estimate.controlSeconds!*tps)<first.tick;
  }
  e.firstChoice={tick:choice.tick,runnerId:choice.runnerId!,ordinaryFirstOutPossible:possible,
   completedInfielderPlay:initialInfielder&&r.rules.outcomes.some(o=>o.runnerId===choice.runnerId&&o.tick>=choice.tick&&oneBaseAttempt(o.runnerId,o.tick))};
 }
 if(!e.firstChoice){const retiredPrior=r.rules.outcomes.find(o=>o.runnerId!==r.batterRunnerId&&['base_control','runner_tag'].includes(o.cause)
  &&initialInfielder&&oneBaseAttempt(o.runnerId,o.tick));
  if(retiredPrior)e.firstChoice={tick:retiredPrior.tick,runnerId:retiredPrior.runnerId,ordinaryFirstOutPossible:null,completedInfielderPlay:true};
 }
 const potentialMiss=!field.ruleFacts.flyCatch&&field.diagnostics.aiTelemetry.roleTransitions.some(t=>t.intercepted===true&&t.eta!==null
  &&(field.ruleFacts.firstGroundContactTick===null||toTick(t.eta)<field.ruleFacts.firstGroundContactTick));
 if(e.candidates.length||potentialMiss){
  // Preserve initial ball, park, runners and seed. Uniform ordinary effort is
  // used only by the recordkeeper. Remove explicit research errors and traits.
  const {executionPerturbationsV95:_execution,recordInitialMovementV98:_movement,...ordinaryBase}=input;
  const ordinaryInput:LiveFieldPlayInputV1={...ordinaryBase,
   fielders:input.fielders.map(f=>{const {technicalSkills:_skills,fieldRelationshipsV99:_relationships,...ordinaryFielder}=f;return{...ordinaryFielder,
    reactionSeconds:.18,topSpeedMps:27*.3048,accelerationMps2:5.2,gloveSpeedMps:11,gloveReachMeters:1.35,gloveRadiusMeters:.11,
    transferSeconds:.46,throwSpeedMps:34,throwDirectionStdRadians:0,fieldingCognition:{decisionSeconds:.04,pursuitCostWeight:1},
    catchRetention:{...f.catchRetention,centerRetentionCapacityJ:160,captureDissipationPowerW:3000}};})};
  try{
   const reference=simulateLiveFieldPlayV1(ordinaryInput),rules=reducePlayableMatchV1({match:r.before,batterRunnerId:r.batterRunnerId,
    regulationInnings:r.regulationInnings,event:{kind:'field_play',facts:{...reference.ruleFacts,buntAttempt:r.bunt}}});
   e.ordinary.available=reference.end.complete&&rules.kind==='applied';
   if(!e.ordinary.available)e.ordinary.unavailableReason=`${reference.end.reason}:${rules.kind==='unresolved'?rules.reason:'reference_incomplete'}`;
   if(e.ordinary.available&&rules.kind==='applied'){
    e.ordinary.outRunnerIds=rules.outcomes.map(o=>o.runnerId);e.ordinary.outTicks=Object.fromEntries(rules.outcomes.map(o=>[o.runnerId,o.tick]));e.ordinary.flyCaught=!!reference.ruleFacts.flyCatch;
    e.ordinary.scoredRunnerIds=[...rules.scoredRunnerIds];
    reference.ruleFacts.runnerTouches.filter(t=>t.tick<=rules.endedAtTick).forEach(t=>{e.ordinary.furthestBases[t.runnerId]=Math.max(e.ordinary.furthestBases[t.runnerId]??0,t.base);});
    if(potentialMiss&&reference.ruleFacts.flyCatch&&!e.candidates.some(c=>c.kind==='fielding')){
     const c=reference.ruleFacts.flyCatch;
     if(c.secureCatchTick<=end)e.candidates.push({id:`missed-fly:${c.firstTouchTick}`,tick:c.firstTouchTick,fielderId:c.fielderId,kind:'fielding'});
    }
   }
  }catch(error){e.ordinary.available=false;e.ordinary.unavailableReason=String(error).slice(0,300);} // Unknown comparison remains explicit pending.
 }
 return classifyLocalScoringV100(e);
}

export function collectLiveErrorCandidatesV100(field:Field,end:number,toTick:(s:number)=>number){
 const e:{candidates:LocalScoringCandidateV100[]}={candidates:[]};
 const facts=field.facts.filter(f=>f.tick<=end),releases=facts.filter(f=>f.kind==='throw_release'),contacts=field.diagnostics.aiTelemetry.contactDiagnostics,
  failure=contacts.filter(c=>toTick(c.elapsedSeconds)<=end&&(c.role==='body'||c.retention?.outcome==='live-ball'));
 // Failed contacts in one loose-ball episode are one candidate. An intervening
 // possession/release starts a genuinely separate opportunity.
 const episodes=new Set<string>();
 for(const c of failure){const at=toTick(c.elapsedSeconds),prior=releases.filter(f=>f.tick<at).length;
  const episode=c.playerId+':'+facts.filter(f=>f.tick<at&&['catch_secured','throw_release'].includes(f.kind)).length;
  if(episodes.has(episode))continue;episodes.add(episode);
  const release=releases.at(prior-1),kind=release?'receiving':'fielding';
  e.candidates.push({id:`contact:${prior}:${at}:${e.candidates.length}`,tick:at,fielderId:c.playerId,kind});
 }
 releases.forEach((f,i)=>{
  const next=releases[i+1]?.tick??end+1,secured=facts.find(c=>c.kind==='catch_secured'&&c.tick>f.tick&&c.tick<next),
   stop=secured?.tick??next,cancel=field.diagnostics.aiTelemetry.throwTargetCancellations.some(c=>c.releasedAt!==null&&toTick(c.releasedAt)===f.tick&&toTick(c.elapsedSeconds)<=end),
   loose=facts.some(c=>c.tick>f.tick&&c.tick<stop&&['ground_contact','over_fence'].includes(c.kind)),
   direction=field.diagnostics.throwDirectionCommands[i]?.actual;
  if((cancel||loose)&&direction&&(direction.yawRadians!==0||direction.pitchRadians!==0)){
   // A failed receipt of an already errant throw belongs to the thrower.
   e.candidates=e.candidates.filter(c=>!(c.kind==='receiving'&&c.tick>f.tick&&c.tick<stop));
   const candidate:LocalScoringCandidateV100={id:`throw:${i}:${f.tick}`,tick:f.tick,fielderId:f.playerId!,kind:'throwing',
    ...(f.runnerId?{targetRunnerId:f.runnerId}:{}),...(f.base?{targetBase:f.base}:{})};e.candidates.push(candidate);
  }
 });
 return {facts,releases,candidates:e.candidates};
}
