import {resolveUncaughtThirdFirstOutV1} from './uncaught-third-first-base-v3';
import {resolveWoodBatSpeedProfileBallContact} from '../../../core/sim/contact/WoodBatSpeedResponseProfile';
import {NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1} from '../../../core/sim/contact/WoodBatProductionProfileV1';
import {requireTerminalScopeV1} from '../bridge/terminal-scope';
import {createSourceFreeBallKernel} from '../../../core/sim/ball/SourceFreeBallKernel';
import {measureRigidBatBallSurfaceSeparation} from '../../../core/sim/contact/RigidBatBallContact';
import {nextUpV1} from '../original/outward-cubic';
import {normalPitchContact} from '../bridge/normal-pitch-contact';
import {quantizeEventTick} from '../../../core/sim/ExactEventTime';
import {simulateLiveFieldPlayV1} from '../../../core/sim/fielding/LiveFieldPlayV1';
import {resolveLiveFielderBodyModelV105,liveFielderBodyControlBoundsV105} from '../../../core/sim/fielding/LiveFielderBodyGeometryV105';
import {buildLiveFieldPlayInputV95} from '../../../integration/browser/LiveFieldInputV95';
import {resolveLiveMatchPlayerPhysicalV98,LIVE_MATCH_BASES_V1} from '../../../integration/browser/LiveBaseballMatchV1';
import {resolveLiveTechnicalTraitsV75} from '../../../integration/browser/LiveTraitProfilesV1';

/** Experimental continuation for a single failed catch; no batted-ball rules. */
export function acceptGeneralLooseCatch(x:any) {
  const {pitch,input,ready,beforeMatch,team,physics}=x, d=(globalThis as any).__normalLooseDynamics;
  if(!d||pitch.call!==null||pitch.contact||Object.values(beforeMatch.bases).some(Boolean)) throw Error('HOLD general loose: unsupported scope');
  const zoneBefore=pitch.diagnostics.officialStrikeZoneContactV94;if(zoneBefore?.kind==='unresolved')throw Error('HOLD general loose: zone unresolved');
  const intendedCall=pitch.diagnostics.swingOffered?'swinging_strike':zoneBefore?.kind==='hit'?'called_strike':'ball';
  const thirdWorldProbe=beforeMatch.strikes===2&&beforeMatch.outs<2&&Object.values(beforeMatch.bases).every(v=>!v)&&(intendedCall==='swinging_strike'||intendedCall==='called_strike'&&zoneBefore?.kind==='hit')&&(input as any).uncaughtThirdModelV1?.version==='uncaught_third_empty_before_two_out_v4';
  if(!thirdWorldProbe)requireTerminalScopeV1(beforeMatch,intendedCall,false,false);
  const hit=d.catcherHit,retention=d.retention, kernel=d.kernel, miss=hit===null&&pitch.diagnostics.unsupportedReason==='catcher_missed_live_ball_requires_successor';
  if(!miss&&(hit?.kind!=='hit'||retention?.outcome.kind!=='live-ball'||!retention.outcome.ball)) throw Error('HOLD general loose: missing actual failed catch');
  const t=miss?d.endElapsedSeconds:hit.at, tps=kernel.descriptor.profile.air.ticksPerSecond, originTick=kernel.descriptor.initial.originTick,
    eventTick=quantizeEventTick(originTick,t,tps), radius=physics.ground.radiusM,
    source={...kernel,originTick,ticksPerSecond:tps},def=input.teams[1-team].defense, players=new Map(input.players.map((p:any)=>[p.playerId,p]));
  const defenders=ready.actors.filter((a:any)=>a.role!=='batter').map((a:any)=>{
    const p:any=players.get(a.playerId),physical=resolveLiveMatchPlayerPhysicalV98(p);
    const model=resolveLiveFielderBodyModelV105(p.heightMeters,physical.gloveReachMeters,Object.fromEntries(Object.keys(liveFielderBodyControlBoundsV105).filter(k=>(physical as any)[k]!==undefined).map(k=>[k,(physical as any)[k]])));
    const body={...a.position,y:a.position.y+model.hipHeightMeters};
    const gy=body.y+model.shoulderHeightMeters-model.hipHeightMeters-Math.min(model.armReachMeters*.4,Math.max(0,model.shoulderHeightMeters-Math.max(physical.gloveRadiusMeters,radius)-.02));
    return {id:a.playerId,role:a.role,body,glove:{...body,y:gy},physical};
  });
  const catcher=defenders.find((a:any)=>a.role==='C'),batter=ready.actors.find((a:any)=>a.role==='batter');
  if(defenders.length!==9||!catcher||!batter) throw Error('HOLD general loose: actors missing');
  const offsetTicks=eventTick-originTick,tolerance=1e-9+Number.EPSILON*Math.max(1,Math.abs(offsetTicks))*8,searchThrough=nextUpV1((offsetTicks+tolerance)/tps);
  if(searchThrough>kernel.descriptor.throughElapsedSeconds)throw Error('HOLD general loose: source ends during handoff tick');
  const bodies=[...defenders.map((a:any)=>({center:a.body,radius:.24})),...defenders.filter((a:any)=>a.role!=='C').map((a:any)=>({center:a.glove,radius:a.physical.gloveRadiusMeters})),{center:{...batter.position,y:batter.position.y+.9},radius:.24}];
  for(const a of bodies){
    const earlier=normalPitchContact(source as any,(q:number)=>{const p=kernel.evaluateAt(q,'incoming').moment.ball.position;return Math.hypot(p.x-a.center.x,p.y-a.center.y,p.z-a.center.z)-a.radius-radius},0,miss?searchThrough:t);
    if(earlier&&quantizeEventTick(originTick,earlier.kind==='hit'?earlier.at:earlier.from,tps)<=eventTick)throw Error('HOLD general loose: competing actor contact');
  }
  const batContact=normalPitchContact(source as any,(q:number)=>measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(q,'incoming').moment.ball,d.rigidAt(q),d.ballPhysical),d.batBound,miss?searchThrough:t);
  if(batContact&&quantizeEventTick(originTick,batContact.kind==='hit'?batContact.at:batContact.from,tps)<=eventTick)throw Error('HOLD general loose: competing bat contact');
  if(!miss){const incoming=kernel.evaluateAt(t,'incoming'),moment={...incoming.moment,ball:retention.outcome.ball};
    if(!(searchThrough>t))throw Error('HOLD general loose: empty same-tick interval');
    const rebound=createSourceFreeBallKernel({...kernel.descriptor,initial:moment,throughElapsedSeconds:searchThrough,...(incoming.materialOrientation?{materialOrientationAtStart:incoming.materialOrientation}:{})}),view={...rebound,originTick,ticksPerSecond:tps};
    if(rebound.boundaries.some((q:any)=>q.elapsedSeconds>=t&&q.elapsedSeconds<=searchThrough))throw Error('HOLD general loose: same-tick ground contact');
    for(const a of bodies){const other=normalPitchContact(view as any,(q:number)=>{const v=rebound.evaluateAt(q,'incoming').moment.ball.position;return Math.hypot(v.x-a.center.x,v.y-a.center.y,v.z-a.center.z)-a.radius-radius},0,searchThrough);if(other)throw Error('HOLD general loose: rebound same-tick actor contact');}
    const otherBat=normalPitchContact(view as any,(q:number)=>measureRigidBatBallSurfaceSeparation(rebound.evaluateAt(q,'incoming').moment.ball,d.rigidAt(q),d.ballPhysical),d.batBound,searchThrough);if(otherBat)throw Error('HOLD general loose: rebound same-tick bat contact');
  }
  const cell=kernel.cells.find((c:any)=>c.fromElapsedSeconds<=t&&c.throughElapsedSeconds>=t);
  if(!cell)throw Error('HOLD general loose: source cell missing');
  const incoming=kernel.evaluateAt(t,'incoming'), moment=miss?incoming.moment:{...incoming.moment,ball:retention.outcome.ball},glove=d.gloveAt(t),
    placements=Object.fromEntries(ready.actors.filter((a:any)=>a.role!=='batter').map((a:any)=>[a.role,{...a.position,y:a.role==='C'?.85:.9}])),
    fieldInput=buildLiveFieldPlayInputV95({ball:moment,physics,orientation:incoming.materialOrientation??incoming.orientation,seed:input.seed,
      field:{bases:LIVE_MATCH_BASES_V1,...(input.park??{fenceRadiusMeters:110,fenceHeightMeters:3})},defense:def,placements,
      players:input.players.map((p:any)=>({playerId:p.playerId,heightMeters:p.heightMeters,physical:resolveLiveMatchPlayerPhysicalV98(p),...(p.traitProfile?{traitProfile:p.traitProfile}:{}),...(resolveLiveTechnicalTraitsV75(p.traitProfile)?{technicalSkills:resolveLiveTechnicalTraitsV75(p.traitProfile)}:{})})),
      batterRunnerId:batter.playerId,batterPosition:batter.position,occupiedBases:beforeMatch.bases,baserunning:'balanced',outs:beforeMatch.outs,maxPlaySeconds:45}),
    fielders=fieldInput.fielders.map((p:any)=>{const a=defenders.find((z:any)=>z.id===p.playerId);return {...p,position:a.body,velocity:{x:0,y:0,z:0},looseGloveV1:p.playerId===catcher.id?glove:{position:a.glove,velocity:{x:0,y:0,z:0}}}});
  (globalThis as any).__robinDynamics=d;
  const rawField=simulateLiveFieldPlayV1({...fieldInput,fielders,runners:thirdWorldProbe?fieldInput.runners:[],loosePitchV1:{...(thirdWorldProbe?{uncaughtThirdV1:true,priorTouchSeconds:t}:{}),version:'loose_pitch_field_v1',...(!thirdWorldProbe&&d.batStationaryAllTime&&batter.velocity&&Math.hypot(batter.velocity.x,batter.velocity.y,batter.velocity.z)===0?{batterMotionV1:{version:'ready_static_batter_v1',actorId:batter.playerId,position:batter.position,velocity:batter.velocity}}:{}),batterBody:{center:{...batter.position,y:batter.position.y+.9},radius:.24},heldBat:d.rigidAt(t),ballPhysical:d.ballPhysical,
    ...(!miss?{initialContact:{playerId:catcher.id,role:'glove',normal:d.retentionNormal,hit:{t,from:hit.from,gap:d.retentionGap,rounding:cell.positionRoundingBoundMeters,speed:cell.maximumPositionSpeedMps+catcher.physical.gloveSpeedMps}}}:{})}} as any) as any;
  if(thirdWorldProbe){
    const rules=resolveUncaughtThirdFirstOutV1({before:beforeMatch,batterId:batter.playerId,firstBase:fieldInput.field.bases.first,baseTouchRadiusMeters:fieldInput.field.baseTouchRadiusMeters??.28,field:rawField});
    const frames=rawField.frames.map((f:any)=>({...ready,tick:f.tick,ball:f.ball,bat:pitch.sampleBatAtTick(f.tick),actors:[...f.fielders.map((a:any)=>({playerId:a.playerId,role:Object.keys(def).find(k=>def[k]===a.playerId),team:1-team,position:a.bodyPoseV105?.foot??{...a.position,y:0},velocity:a.velocity,...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105}:{})})),...f.runners.map((r:any)=>({playerId:r.runnerId,role:'runner',team,position:r.bodyPoseV105?.foot??{...r.position,y:0},velocity:r.velocity,...(r.bodyPoseV105?{bodyPoseV105:r.bodyPoseV105}:{})}))],phase:f.ball.possessedBy?'held':'pitch',ballKind:'pitch',fairKnown:false,possessedBy:f.ball.possessedBy}));
    return {field:rawField,call:intendedCall,frames,releaseFrames:pitch.frames.filter((f:any)=>f.elapsedSeconds<=t),bodyEvents:miss?[]:[{kind:'glove_contact',tick:eventTick,elapsedSeconds:t,playerId:catcher.id,position:incoming.moment.ball.position}],scope:'UNCAUGHT_THIRD_EMPTY_ZERO_OUT_V1',sourceProvenance:{kind:'normal_source_descriptor_v2'},uncaughtThirdResult:rules};
  }
  const proof=(input as any).prescribedBatModelV1,u=rawField.diagnostics?.unresolvedDetail,last=rawField.frames.at(-1),batAt=last?d.rigidAt(rawField.end.elapsedSeconds):null,batBefore=last?d.rigidAt(Math.max(t,rawField.end.elapsedSeconds-.02)):null,
   moved=batAt&&batBefore&&Math.hypot(batAt.pose.tip.x-batBefore.pose.tip.x,batAt.pose.tip.y-batBefore.pose.tip.y,batAt.pose.tip.z-batBefore.pose.tip.z)>0,
   fixtureDead=proof?.version==='prescribed_bat_attached_and_no_interference_v1'&&proof.scope==='CURRENT_SWING_CLIP_ONLY'&&pitch.diagnostics.batReferenceScope==='FINITE_MEASURED_KEYS_ONLY_NOT_AN_EQUIPMENT_RELEASE_FACT'&&pitch.diagnostics.batPlaybackV88?.reference?.provenance?.clipId===pitch.clipId&&rawField.end.tick<=pitch.diagnostics.referenceThroughTick&&rawField.end.tick>=pitch.diagnostics.referenceStartTick&&!miss&&retention?.outcome.kind==='live-ball'&&pitch.diagnostics.swingOffered===true&&!pitch.contact&&hit?.kind==='hit'&&last&&u?.kind==='loose_external_contact'&&u.collider==='bat'&&u.continuousOrderCertifiedV1===true&&moved&&beforeMatch.strikes<=1&&beforeMatch.balls<=2&&Object.values(beforeMatch.bases).every(v=>!v);
 let field=rawField;
 if(fixtureDead){const ball={tick:rawField.end.tick,position:last.ball.position,velocity:last.ball.velocity,spin:last.ball.spin},impact=resolveWoodBatSpeedProfileBallContact(ball,batAt,d.ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1),event={kind:'bat_after_catcher_contact',tick:rawField.end.tick,elapsedSeconds:rawField.end.elapsedSeconds,playerId:batter.playerId,position:ball.position,incomingVelocity:ball.velocity,outgoingVelocity:impact.exitVelocity,basis:'NPB_UNCAUGHT_SWUNG_HELD_BAT_MODEL_V1',modelAssumptions:{version:'prescribed_bat_attached_and_no_interference_v1',basis:'EXPLICIT_MODEL_NOT_MEASURED'}};
  const priorEnd=rawField.facts.findLast((f:any)=>f.kind==='play_end');if(!priorEnd)throw Error('HOLD: missing field end fact');field={...rawField,end:{...rawField.end,complete:true,reason:'swung_bat_dead_ball'},facts:[...rawField.facts.filter((f:any)=>f.kind!=='play_end'),event,{...priorEnd,reason:'swung_bat_dead_ball'}],frames:rawField.frames.map((f:any,i:number)=>i===rawField.frames.length-1?{...f,ball:{...f.ball,velocity:impact.exitVelocity,spin:impact.exitSpin}}:f)};
 }
  if(!fixtureDead&&(!field.end.complete||!field.facts.some((f:any)=>f.kind==='catch_secured')||!field.frames.at(-1)?.ball.possessedBy))throw Error('HOLD general loose: custody unresolved: '+field.end.reason+' '+JSON.stringify({end:field.end,diagnostics:field.diagnostics}));
  const zone=pitch.diagnostics.officialStrikeZoneContactV94;if(zone?.kind==='unresolved')throw Error('HOLD general loose: zone unresolved');
  const call=pitch.diagnostics.swingOffered?'swinging_strike':zone?.kind==='hit'?'called_strike':'ball';
  const frames=field.frames.map((f:any)=>({...ready,tick:f.tick,ball:f.ball,bat:pitch.sampleBatAtTick(f.tick),actors:[...f.fielders.map((a:any)=>({playerId:a.playerId,role:Object.keys(def).find(k=>def[k]===a.playerId),team:1-team,position:a.bodyPoseV105?.foot??{...a.position,y:0},velocity:a.velocity,...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105}:{})})),batter],phase:f.ball.possessedBy?'held':'pitch',ballKind:'pitch',fairKnown:false,possessedBy:f.ball.possessedBy}));
  return {field,call,frames,releaseFrames:pitch.frames.filter((f:any)=>f.elapsedSeconds<=t),bodyEvents:miss?[]:[{kind:'glove_contact',tick:eventTick,elapsedSeconds:t,playerId:catcher.id,position:incoming.moment.ball.position}],scope:'EXPERIMENTAL_CATCH_FAILURE_OR_MISS_DYNAMIC_BAT_EMPTY_NONTERMINAL',sourceProvenance:{kind:'normal_source_descriptor_v2'}};
}
