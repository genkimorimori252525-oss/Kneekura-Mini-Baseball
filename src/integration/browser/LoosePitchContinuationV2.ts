import {quantizeEventTick} from '../../core/sim/ExactEventTime';
import {simulateLiveFieldPlayV1} from '../../core/sim/fielding/LiveFieldPlayV1';
import {resolveLiveFielderBodyModelV105,liveFielderBodyControlBoundsV105} from '../../core/sim/fielding/LiveFielderBodyGeometryV105';
import {buildLiveFieldPlayInputV95} from './LiveFieldInputV95';
import {resolveLiveMatchPlayerPhysicalV98,LIVE_MATCH_BASES_V1} from './LiveBaseballMatchV1';
import {resolveLiveTechnicalTraitsV75} from './LiveTraitProfilesV1';

type LooseCall='ball'|'called_strike'|'swinging_strike';
export type LooseRunnerOutcomeV2=Readonly<{runnerId:string;base:number;retired:boolean;scored:boolean;tick:number;defenderId:string|null}>;

/** Whole-pitch continuation after the catcher fails to secure a pitch. Runners
 * and a third-strike batter run in the real field world when it resolves; when
 * it cannot, the simple model keeps the game going and records why. */
export function resolveLoosePitchContinuationV2(x:any){
  const {pitch,input,ready,beforeMatch,team,physics,baserunning}=x,d=(globalThis as any).__normalLooseDynamics;
  const zone=pitch.diagnostics.officialStrikeZoneContactV94,swing=pitch.diagnostics.swingOffered===true,
    call:LooseCall=swing?'swinging_strike':zone?.kind==='hit'?'called_strike':'ball';
  const thirdStrike=beforeMatch.strikes>=2&&call!=='ball',batterRuns=thirdStrike&&(beforeMatch.bases.first===null||beforeMatch.outs===2);
  const hit=d?.catcherHit,retention=d?.retention,kernel=d?.kernel,live=hit?.kind==='hit'&&retention?.outcome.kind==='live-ball'&&!!retention.outcome.ball;
  const t=live?hit.at:Math.min(d.endElapsedSeconds,kernel.descriptor?.throughElapsedSeconds??d.endElapsedSeconds);
  const tps=physics.air.ticksPerSecond,originTick=kernel.originTick??kernel.descriptor.initial.originTick,eventTick=quantizeEventTick(originTick,t,tps);
  const ballAt=kernel.evaluateAt(t,'incoming').moment.ball,base={detail:{live,hit:hit?.kind??null,retention:retention?.outcome?.kind??null,reason:retention?.outcome?.reason??null,speed:Math.hypot(ballAt.velocity.x,ballAt.velocity.y,ballAt.velocity.z),ball:ballAt.position,glove:d.gloveAt(t).position,t,plane:planeCrossing(kernel,d)},call,batterRuns,eventTick,releaseFrames:pitch.frames.filter((f:any)=>f.elapsedSeconds<=t),sourceProvenance:{kind:'normal_source_descriptor_v2'}};
  let reason:string;
  try{
    const world=runLooseWorld({pitch,input,ready,beforeMatch,team,physics,baserunning,d,t,live,batterRuns,thirdStrike,originTick,eventTick,robin:x.robin});
    if(world)return {...base,...world,scope:'LOOSE_FIELD_WORLD_V2'};
    reason='FIELD_INCOMPLETE';
  }catch(error){reason='FIELD_HOLD: '+String((error as Error).message).slice(0,160);}
  return {...base,...simpleLooseOutcome({input,ready,beforeMatch,team,kernel,t,eventTick,batterRuns,originTick,tps,physics,live}),scope:'SIMPLE_LOOSE_MODEL_V1',fallbackReason:reason};
}

function runLooseWorld(x:any){
  const {pitch,input,ready,beforeMatch,team,physics,baserunning,d,t,live,batterRuns,eventTick,robin}=x,kernel=d.kernel,
    radius=physics.ground.radiusM,def=input.teams[1-team].defense,players=new Map(input.players.map((p:any)=>[p.playerId,p]));
  const defenders=ready.actors.filter((a:any)=>a.role!=='batter'&&a.role!=='runner').map((a:any)=>{
    const p:any=players.get(a.playerId),physical=resolveLiveMatchPlayerPhysicalV98(p),
      model=resolveLiveFielderBodyModelV105(p.heightMeters,physical.gloveReachMeters,Object.fromEntries(Object.keys(liveFielderBodyControlBoundsV105).filter(k=>(physical as any)[k]!==undefined).map(k=>[k,(physical as any)[k]]))),
      body={...a.position,y:a.position.y+model.hipHeightMeters},
      gy=body.y+model.shoulderHeightMeters-model.hipHeightMeters-Math.min(model.armReachMeters*.4,Math.max(0,model.shoulderHeightMeters-Math.max(physical.gloveRadiusMeters,radius)-.02));
    return {id:a.playerId,role:a.role,body,glove:{...body,y:gy},physical};
  });
  const catcher=defenders.find((a:any)=>a.role==='C'),batter=ready.actors.find((a:any)=>a.role==='batter');
  if(defenders.length!==9||!catcher||!batter)throw Error('actors missing');
  const incoming=kernel.evaluateAt(t,'incoming'),moment=live?{...incoming.moment,ball:d.retention.outcome.ball}:incoming.moment,glove=d.gloveAt(t),
    placements=Object.fromEntries(ready.actors.filter((a:any)=>a.role!=='batter'&&a.role!=='runner').map((a:any)=>[a.role,{...a.position,y:a.role==='C'?.85:.9}])),
    fieldInput=buildLiveFieldPlayInputV95({ball:moment,physics,orientation:incoming.materialOrientation??incoming.orientation??{x:0,y:0,z:0,w:1},seed:input.seed,
      field:{bases:LIVE_MATCH_BASES_V1,...(input.park??{fenceRadiusMeters:110,fenceHeightMeters:3})},defense:def,placements:placements as any,
      players:input.players.map((p:any)=>({playerId:p.playerId,heightMeters:p.heightMeters,physical:resolveLiveMatchPlayerPhysicalV98(p),...(p.traitProfile?{traitProfile:p.traitProfile}:{}),...(resolveLiveTechnicalTraitsV75(p.traitProfile)?{technicalSkills:resolveLiveTechnicalTraitsV75(p.traitProfile)}:{})})),
      batterRunnerId:batter.playerId,batterPosition:batter.position,occupiedBases:beforeMatch.bases,baserunning:baserunning??'balanced',outs:beforeMatch.outs,maxPlaySeconds:45}),
    fielders=fieldInput.fielders.map((p:any)=>{const a=defenders.find((z:any)=>z.id===p.playerId);return {...p,position:a.body,velocity:{x:0,y:0,z:0},looseGloveV1:p.playerId===catcher.id?glove:{position:a.glove,velocity:{x:0,y:0,z:0}}}});
  (globalThis as any).__robinDynamics=d;
  const cell=kernel.cells?.find((c:any)=>c.fromElapsedSeconds<=t&&c.throughElapsedSeconds>=t);
  const batterStatic=d.batStationaryAllTime&&batter.velocity&&Math.hypot(batter.velocity.x,batter.velocity.y,batter.velocity.z)===0;
  const field=simulateLiveFieldPlayV1({...fieldInput,...(input.fieldThrowV1?{fieldThrowPolicyV1:input.fieldThrowV1}:{}),...(input.fieldRangeV1?{fieldRangePolicyV1:input.fieldRangeV1}:{}),fielders,runners:withLeads((batterRuns?fieldInput.runners:fieldInput.runners.filter((r:any)=>r.initialBase>0)) as any[],ready),loosePitchV1:{version:'loose_pitch_field_v1',
    ...(batterRuns?{uncaughtThirdV1:true,priorTouchSeconds:t}:{}),...(!live&&!batterRuns?{}:{priorTouchSeconds:t}),
    ...(robin?{pitchReleaseSeconds:0,hiddenAfterSeconds:robin.hiddenAfterSeconds,legacyArrivedSeconds:robin.legacyArrivedSeconds,opticalPolicy:'hidden_through_legacy_arrival_then_impact_v1'}:{}),
    ...(!batterRuns&&batterStatic?{batterMotionV1:{version:'ready_static_batter_v1',actorId:batter.playerId,position:batter.position,velocity:batter.velocity}}:{}),
    batterBody:{center:{...batter.position,y:batter.position.y+.9},radius:.24},heldBat:d.rigidAt(t),ballPhysical:d.ballPhysical,
    ...(live?{initialContact:{playerId:catcher.id,role:'glove',normal:d.retentionNormal,hit:{t,from:hit0(d),gap:d.retentionGap,rounding:cell?.positionRoundingBoundMeters??1e-8,speed:(cell?.maximumPositionSpeedMps??60)+catcher.physical.gloveSpeedMps}}}:{})}} as any) as any;
  if(!field.end.complete||field.diagnostics?.unresolvedDetail||!field.frames.at(-1)?.ball.possessedBy)throw Error('incomplete '+field.end.reason+' '+String(field.diagnostics?.unresolvedDetail?.kind??'')+' live='+live+' t='+t.toFixed(3));
  const facts=field.experimentalUncaughtThirdFacts,secured=field.facts.find((f:any)=>f.kind==='catch_secured');if(!secured)return null;
  const outcomes:LooseRunnerOutcomeV2[]=field.finalRunners.map((r:any)=>({runnerId:r.runnerId,base:r.base,retired:r.retired,scored:r.scored,
    tick:outTick(field,r,facts),defenderId:outDefender(field,r)}));
  const frames=field.frames.map((f:any)=>({...ready,tick:f.tick,ball:f.ball,bat:pitch.sampleBatAtTick(f.tick),actors:[...f.fielders.map((a:any)=>({playerId:a.playerId,role:Object.keys(def).find(k=>def[k]===a.playerId),team:1-team,position:a.bodyPoseV105?.foot??{...a.position,y:0},velocity:a.velocity,...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105}:{})})),
    ...f.runners.map((r:any)=>({playerId:r.runnerId,role:'runner',team,position:r.bodyPoseV105?.foot??{...r.position,y:0},velocity:r.velocity,...(r.bodyPoseV105?{bodyPoseV105:r.bodyPoseV105}:{})})),...(batterRuns?[]:[batter])],
    phase:f.ball.possessedBy?'held':'pitch',ballKind:'pitch',fairKnown:false,possessedBy:f.ball.possessedBy}));
  return {field,endTick:field.end.tick,outcomes,frames,bodyEvents:live?[{kind:'glove_contact',tick:eventTick,elapsedSeconds:t,playerId:catcher.id,position:incoming.moment.ball.position}]:[],facts:field.facts};
}
const hit0=(d:any)=>d.catcherHit.from;
function withLeads(runners:any[],ready:any){const lead=new Map(ready.actors.filter((a:any)=>a.role==='runner').map((a:any)=>[a.playerId,a.position]));return runners.map(r=>lead.has(r.runnerId)?{...r,position:lead.get(r.runnerId)}:r);}
function outTick(field:any,r:any,facts:any){
  const touch=field.facts.filter((f:any)=>f.kind==='runner_base_touch'&&f.runnerId===r.runnerId).at(-1);
  const tag=facts?.controlledRunnerTags?.find((f:any)=>f.runnerId===r.runnerId);
  return tag?.tick??touch?.tick??field.end.tick;
}
function outDefender(field:any,r:any){return field.facts.find((f:any)=>f.kind==='controlled_runner_tag'&&f.runnerId===r.runnerId)?.defenderId??null}

/** No field world: the ball stays near the backstop side, the catcher retrieves
 * it, and each runner takes the next base only if the throw cannot beat them. */
function simpleLooseOutcome(x:any){
  const {input,ready,beforeMatch,team,kernel,t,batterRuns,originTick,tps,physics,live}=x,def=input.teams[1-team].defense;
  const ball=kernel.evaluateAt(t,'incoming').moment.ball,speed=Math.hypot(ball.velocity.x,ball.velocity.y,ball.velocity.z);
  const roll=Math.min(18,speed*(live?.07:.28)),retrieve=.45+roll/6.5+.35,throwSeconds=(meters:number)=>.45+meters/32;
  const players=new Map(input.players.map((p:any)=>[p.playerId,p]));
  const runSpeed=(id:string)=>{const p:any=players.get(id);return resolveLiveMatchPlayerPhysicalV98(p).topSpeedMps};
  const baseDistance=27.43,catcherToNext=[27.43,38.8,27.43,6];
  const order:[string,number][]=[['third',3],['second',2],['first',1]];
  const occupied=new Set<number>(),outcomes:LooseRunnerOutcomeV2[]=[];
  const endSeconds=t+retrieve+1.2,endTick=quantizeEventTick(originTick,endSeconds,tps);
  for(const [name,baseIndex] of order){const id=beforeMatch.bases[name];if(!id)continue;
    const need=baseDistance/runSpeed(id),beat=retrieve+throwSeconds(catcherToNext[baseIndex]);
    const next=baseIndex+1,advance=beat>need+.15&&!occupied.has(next);
    const finalBase=advance?next:baseIndex;if(finalBase<4)occupied.add(finalBase);
    outcomes.push({runnerId:id,base:finalBase,retired:false,scored:finalBase===4,tick:endTick,defenderId:null});}
  if(batterRuns){const batterId=ready.actors.find((a:any)=>a.role==='batter')!.playerId,need=baseDistance/runSpeed(batterId),beat=retrieve+throwSeconds(catcherToNext[0]);
    outcomes.push(beat>need?{runnerId:batterId,base:1,retired:false,scored:false,tick:endTick,defenderId:null}:{runnerId:batterId,base:0,retired:true,scored:false,tick:endTick,defenderId:def.C});}
  void physics;
  return {field:null,endTick,outcomes,frames:[],bodyEvents:[],facts:[]};
}

/** Where the pitch really crossed the catcher's plane, and how far the mitt was. Measurement only. */
function planeCrossing(kernel:any,d:any){
  for(let q=.1;q<1.6;q+=.002){let b;try{b=kernel.evaluateAt(q,'incoming').moment.ball}catch{return null}
    if(b.position.z<=-.85){const g=d.gloveAt(q).position;return {t:q,x:b.position.x,y:b.position.y,speed:Math.hypot(b.velocity.x,b.velocity.y,b.velocity.z),gap:Math.hypot(b.position.x-g.x,b.position.y-g.y,b.position.z-g.z)};}}
  return null;
}
