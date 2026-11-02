import type {Vec3} from '../../model/geometry';
import type {BaseballBase} from '../../rules/PhysicalRuleFacts';
import type {DefensiveIntent} from './DefensiveDecision';
import {liveFieldArrivalSecondsV1,type LiveFieldRoleActorV1,type LiveFieldRoleV1} from './LiveFieldRoleAssignmentV1';
import {buildLivePursuitOptionsV1,type LivePursuitWindowV1} from './LiveFieldPursuitV1';

export type LiveFieldAdviceV1=Readonly<{sourceId:string;targetPlayerId?:string;role:LiveFieldRoleV1;trust:number}>;
export type LiveFieldDecisionContextV1=Readonly<{elapsedSeconds:number;observationSeconds:number|null;
 self:LiveFieldRoleActorV1;others:readonly LiveFieldRoleActorV1[];bases:Readonly<Record<BaseballBase,Vec3>>;
 ball:Vec3|null;ballVelocity:Vec3;possessionPlayerId:string|null;
 pickup:Readonly<{point:Vec3;eta:number;intercepted:boolean;latenessSeconds?:number}>|null;
 pickupWindowsV120?:readonly LivePursuitWindowV1[];
 threats:readonly Readonly<{base:BaseballBase;arrivalSeconds:number}>[];received:readonly LiveFieldAdviceV1[];
 previous?:LiveFieldRoleV1;cautious?:boolean;ownTask?:LiveFieldRoleV1;
 /** Present: a bag is one man's job, and a player only offers to cover where this allows it. */
 coverAllowedV1?:(base:BaseballBase,arrivalSeconds:number)=>boolean}>;
export type LiveFieldDecisionCandidateV1=Readonly<{role:LiveFieldRoleV1;intent:DefensiveIntent;cost:number;arrivalSeconds:number;
 opportunityCost:number;competitionCost:number;switchCost:number;reason:string}>;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
export const liveFieldIntentV1=(role:LiveFieldRoleV1):DefensiveIntent=>role.intent==='intercept'?{kind:'ball_handler'}
 :role.intent==='base_cover'&&role.targetBase?{kind:'base_cover',base:role.targetBase}
 :role.intent==='relay'||role.intent==='backup'?{kind:role.intent,target:{x:role.point.x,z:role.point.z}}:{kind:'hold'};

/** Each call owns one player's alternatives. Inputs contain estimates only;
 * neither hidden world/motion callbacks nor another player's chosen future is
 * available. These costs are provisional tactical preferences, not physics. */
export function evaluateLiveFieldDecisionV1(input:LiveFieldDecisionContextV1){
 const self=input.self,candidates:LiveFieldDecisionCandidateV1[]=[],others=input.others.filter(a=>a.playerId!==self.playerId),
  own=(taskId:string,intent:LiveFieldRoleV1['intent'],point:Vec3,targetBase:BaseballBase|null=null):LiveFieldRoleV1=>({playerId:self.playerId,taskId,intent,point:{...point},targetBase}),
  hold=own('hold:'+self.playerId,'hold',self.homePosition),pursuit=self.pursuitCostWeight??1;
 let pursuitTrace:ReturnType<typeof buildLivePursuitOptionsV1>|undefined;
 // A cover declaration is evidence of overlapping work, not a guaranteed
 // arrival or a central reservation. Only personally observed peers count.
 const redundantCoverCost=(role:LiveFieldRoleV1,arrival:number)=>{
  if(role.intent!=='base_cover'||role.targetBase===null||input.observationSeconds===null)return 0;
  const point=role.point,continuing=input.previous?.intent==='base_cover'&&input.previous.targetBase===role.targetBase,
   closing=(a:LiveFieldRoleActorV1)=>{const d=distance(a.position,point);return d>0?
    ((point.x-a.position.x)*a.velocity.x+(point.z-a.position.z)*a.velocity.z)/d:0;},ownClosing=closing(self);
  let cost=0;
  for(const peer of others){
   const claim=input.received.find(m=>m.sourceId===peer.playerId&&m.role.playerId===peer.playerId
    &&m.role.intent==='base_cover'&&m.role.targetBase===role.targetBase&&m.trust>0);
   if(!claim)continue;
   const peerClosing=closing(peer);if(peerClosing<-.1)continue; // a stale declaration must not conceal a visible departure
   const peerArrival=liveFieldArrivalSecondsV1(peer,point);
   let preferred=peerArrival+.15<arrival;
   if(!preferred&&Math.abs(peerArrival-arrival)<=.15){
    if(!continuing)preferred=true; // a received adopted cover precedes a new competing proposal
    else if(Math.abs(peerClosing-ownClosing)>.1)preferred=peerClosing>ownClosing;
    else {
     // Both are continuing at similar ETAs. Resolve the observable geometric
     // tie in field-relative coordinates, preserving translation/rotation and
     // avoiding mutual yield or identity/position-name ownership.
     const reference=input.bases[role.targetBase===4?1:4],dx=reference.x-point.x,dz=reference.z-point.z,
      along=(a:LiveFieldRoleActorV1)=>(a.position.x-point.x)*dx+(a.position.z-point.z)*dz,
      side=(a:LiveFieldRoleActorV1)=>dx*(a.position.z-point.z)-dz*(a.position.x-point.x),
      difference=along(peer)-along(self);
     preferred=Math.abs(difference)>1e-8?difference<0:side(peer)<side(self)-1e-8;
    }
   }
   // At default trust .5 this cancels one ordinary cover's 3.5 benefit.
   // It remains finite, and duplicate messages cannot amplify the penalty.
   if(preferred)cost=Math.max(cost,7*Math.min(1,claim.trust));
  }
  return cost;
 };
 const add=(role:LiveFieldRoleV1,benefit:number,competitionScale:number,reason:string,arrival=liveFieldArrivalSecondsV1(self,role.point))=>{
  const competitor=Math.min(...others.filter(a=>a.playerId!==input.possessionPlayerId).map(a=>{
    const claim=input.received.find(m=>m.sourceId===a.playerId&&m.role.intent==='intercept');
    return claim&&role.intent!=='intercept'?Infinity:liveFieldArrivalSecondsV1(a,role.point);
  })),competitionCost=Math.max(0,arrival-competitor-.15)*competitionScale+redundantCoverCost(role,arrival),
   switchCost=input.previous&&input.previous.taskId!==role.taskId?.25:0,
   opportunityCost=role.intent==='backup'?distance(self.homePosition,role.point)/self.topSpeedMps*.1*pursuit:0,
   cost=arrival*.3*(role.intent==='intercept'||role.intent==='backup'?pursuit:1)+competitionCost+opportunityCost+switchCost-benefit;
  if(Number.isFinite(cost))candidates.push({role,intent:liveFieldIntentV1(role),cost,arrivalSeconds:arrival,opportunityCost,competitionCost,switchCost,reason});
 };
 candidates.push({role:hold,intent:{kind:'hold'},cost:0,arrivalSeconds:0,opportunityCost:0,competitionCost:0,switchCost:0,reason:'no_useful_local_action'});
 if(input.ownTask){add(input.ownTask,100,0,'own_possession_decision',0);}
 else if(input.observationSeconds!==null&&input.ball){
  if(input.pickupWindowsV120&&input.possessionPlayerId===null){
   const pursuitOptions=buildLivePursuitOptionsV1({self,others,windows:input.pickupWindowsV120,bases:input.bases,threats:input.threats,
    claims:input.received.filter(m=>m.role.intent==='intercept'&&m.trust>0).map(m=>({playerId:m.sourceId,point:m.role.point,trust:m.trust}))});
   pursuitTrace=pursuitOptions;
   for(const option of pursuitOptions.options){
    const baseBenefit=option.family==='direct'?4:option.family==='following'?3:2.2,
     benefit=baseBenefit+option.additionalValue-option.uncoveredLoss-(option.latenessSeconds??0)*pursuit
      -(input.cautious&&!option.intercepted?2:0);
    add(own(option.taskId,'intercept',option.point),benefit,option.competitionScale,option.reason,Math.max(option.eta,option.arrivalSeconds));
   }
  }else if(input.pickup&&input.possessionPlayerId===null){
   const late=input.pickup.latenessSeconds??0,
    benefit=4-(input.cautious&&!input.pickup.intercepted?2:0)-late*pursuit;
   add(own('pickup','intercept',input.pickup.point),benefit,4,'observed_ball_opportunity',Math.max(input.pickup.eta,liveFieldArrivalSecondsV1(self,input.pickup.point,self.position.y>input.pickup.point.y?1:0)));
  }
  for(const threat of input.threats){
   const point=input.bases[threat.base],role=own('cover:'+threat.base,'base_cover',point,threat.base),
    arrival=liveFieldArrivalSecondsV1(self,point),late=Math.max(0,arrival-threat.arrivalSeconds),
    prior=self.defensivePosition==='C'&&threat.base!==4?.8:0;
   if(!input.coverAllowedV1||input.coverAllowedV1(threat.base,arrival))add(role,3.5-Math.min(1,late*.3)-prior,3,'observed_runner_threat',arrival);
  }
  const primary=input.threats.slice().sort((a,b)=>a.arrivalSeconds-b.arrivalSeconds)[0],
   from=input.possessionPlayerId?others.find(a=>a.playerId===input.possessionPlayerId)?.position??input.ball:input.ball,
   targetPoint=primary?input.bases[primary.base]:input.pickup?.point??input.ball,
   dx=targetPoint.x-from.x,dz=targetPoint.z-from.z,length=Math.hypot(dx,dz),
   unit=length>.01?{x:dx/length,z:dz/length}:Math.hypot(input.ballVelocity.x,input.ballVelocity.z)>.01
    ?{x:input.ballVelocity.x/Math.hypot(input.ballVelocity.x,input.ballVelocity.z),z:input.ballVelocity.z/Math.hypot(input.ballVelocity.x,input.ballVelocity.z)}:null;
  if(unit){
   const point={x:targetPoint.x+unit.x*(input.possessionPlayerId?10:6),y:0,z:targetPoint.z+unit.z*(input.possessionPlayerId?10:6)};
   add(own('backup:'+String(primary?.base??'pickup'),'backup',point),1.8,1.5,'support_observed_play');
  }
  if(input.possessionPlayerId&&length>self.throwSpeedMps*.9){
   add(own('relay:'+String(primary?.base),'relay',{x:(from.x+targetPoint.x)/2,y:0,z:(from.z+targetPoint.z)/2}),2,2,'relay_for_observed_distance');
  }
 }
 // Hearing a teammate is independent of acquiring the ball visually.
 const target=input.received.find(m=>m.targetPlayerId===self.playerId&&m.role.intent!=='intercept');
 if(target&&target.trust>.1){const arrival=liveFieldArrivalSecondsV1(self,target.role.point),continuing=input.previous?.taskId===target.role.taskId?1.5:0;
  add({...target.role,playerId:self.playerId},1.5+4*target.trust/(1+arrival*.5)+continuing,1,'received_target_proposal',arrival);}
 // Stable identity is a computational tie break, never an arrival/out fact.
 candidates.sort((a,b)=>a.cost-b.cost||a.role.taskId.localeCompare(b.role.taskId));
 const selected=candidates[0],advice=input.received.filter(m=>m.targetPlayerId===self.playerId).map(m=>{
  const accepted=m.role.intent===selected.role.intent&&m.role.targetBase===selected.role.targetBase&&distance(m.role.point,selected.role.point)<1e-8;
  return {sourceId:m.sourceId,accepted,reason:accepted?'consistent_with_local_evidence':'local_alternative_preferred'};
 });
 return {role:selected.role,intent:selected.intent,candidates,advice,...(pursuitTrace?{pursuit:pursuitTrace}:{}),
  reason:input.observationSeconds===null&&!input.ownTask&&selected.role.intent==='hold'?'awaiting_observation':selected.reason};
}

type RetouchObservationV118=Readonly<{runnerId:string;initialBase:0|1|2|3;position:Vec3;velocity:Vec3}>;
export type LiveRetouchBeliefV118=Readonly<{touchSeconds:number|null;flySeen:boolean;
 atTouch:readonly Readonly<{runnerId:string;base:BaseballBase;away:boolean|null}>[];
 required:readonly Readonly<{runnerId:string;base:BaseballBase}>[];
 last:Readonly<{at:number;runners:readonly RetouchObservationV118[]}>|null}>;
/** A remembered estimate from personal cuts. No canonical retouchBase, future
 * motion, or retrospective lookup into unobserved world history is accepted. */
export function updateLiveRetouchBeliefV118(previous:LiveRetouchBeliefV118|undefined,input:Readonly<{observationSeconds:number|null;
 firstTouchSeconds:number|null;flyCaught:boolean;bases:Readonly<Record<BaseballBase,Vec3>>;touchRadiusMeters:number;runners:readonly RetouchObservationV118[]}>):LiveRetouchBeliefV118{
 const old=previous??{touchSeconds:null,flySeen:false,atTouch:[],required:[],last:null};
 if(input.observationSeconds===null)return old;
 let atTouch=old.atTouch,touchSeconds=old.touchSeconds,required=old.required;
 if(touchSeconds===null&&input.firstTouchSeconds!==null){touchSeconds=input.firstTouchSeconds;
  atTouch=input.runners.filter(r=>r.initialBase>0).map(r=>{
   const prior=old.last?.runners.find(p=>p.runnerId===r.runnerId),dt=old.last?touchSeconds!-old.last.at:Infinity,
    predicted=prior&&dt>=0?{x:prior.position.x+prior.velocity.x*dt,y:prior.position.y,z:prior.position.z+prior.velocity.z*dt}:null,
    uncertainty=prior?Math.hypot(prior.velocity.x,prior.velocity.z)*.04:0;
   return {runnerId:r.runnerId,base:r.initialBase as BaseballBase,away:predicted?distance(predicted,input.bases[r.initialBase as BaseballBase])>input.touchRadiusMeters+uncertainty:null};
  });
 }
 if(input.flyCaught&&!old.flySeen)required=atTouch.filter(r=>r.away===true).map(r=>({runnerId:r.runnerId,base:r.base}));
 required=required.filter(r=>!input.runners.some(p=>p.runnerId===r.runnerId&&distance(p.position,input.bases[r.base])<=input.touchRadiusMeters));
 return {touchSeconds,flySeen:old.flySeen||input.flyCaught,atTouch,required,
  last:{at:input.observationSeconds,runners:input.runners.map(r=>({...r,position:{...r.position},velocity:{...r.velocity}}))}};
}
