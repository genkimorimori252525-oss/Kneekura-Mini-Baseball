import type {Vec3} from '../../model/geometry';
import type {BaseballBase} from '../../rules/PhysicalRuleFacts';
import {liveFieldArrivalSecondsV1,type LiveFieldRoleActorV1} from './LiveFieldRoleAssignmentV1';

export type LivePursuitWindowV1=Readonly<{family:'direct'|'following'|'recovery';point:Vec3;eta:number;arrivalSeconds:number;
 intercepted:boolean;latenessSeconds?:number}>;
export type LivePursuitOptionV1=LivePursuitWindowV1&Readonly<{taskId:string;additionalValue:number;uncoveredLoss:number;
 uncertainty:number;competitionScale:number;reason:string}>;
export type LivePursuitContextV1=Readonly<{self:LiveFieldRoleActorV1;others:readonly LiveFieldRoleActorV1[];
 windows:readonly LivePursuitWindowV1[];claims:readonly Readonly<{playerId:string;point:Vec3;trust:number}>[];
 bases:Readonly<Record<BaseballBase,Vec3>>;threats:readonly Readonly<{base:BaseballBase;arrivalSeconds:number}>[]}>;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z),clamp=(n:number)=>Math.max(0,Math.min(1,n));

/** Local marginal capture value. No peer catch/failed catch, canonical future,
 * role quota, or success probability is accepted. Coefficients are controller
 * preferences, not empirical MLB frequencies or additional ability modifiers. */
export function buildLivePursuitOptionsV1(input:LivePursuitContextV1){
 if(input.windows.length>3||new Set(input.windows.map(w=>w.family)).size!==input.windows.length
  ||input.windows.some(w=>!['direct','following','recovery'].includes(w.family)||![w.point.x,w.point.y,w.point.z,w.eta,w.arrivalSeconds,w.latenessSeconds??0].every(Number.isFinite)
   ||w.eta<0||w.arrivalSeconds<0||(w.latenessSeconds??0)<0))throw Error('invalid individual pursuit windows');
 const direct=input.windows.find(w=>w.family==='direct'),options:LivePursuitOptionV1[]=[],
  rejections:Readonly<{family:LivePursuitWindowV1['family'];reason:string}>[]=[];
 const peers=input.claims.flatMap(claim=>{const actor=input.others.find(a=>a.playerId===claim.playerId);
  return actor&&claim.trust>0?[{claim,eta:liveFieldArrivalSecondsV1(actor,direct?.point??claim.point)}]:[];}),
  earliest=peers.slice().sort((a,b)=>a.eta-b.eta||b.claim.trust-a.claim.trust)[0],
  coverRisks=input.threats.map(threat=>{const point=input.bases[threat.base];return{threat,
   ownEta:liveFieldArrivalSecondsV1(input.self,point),peerEta:Math.min(...input.others.map(a=>liveFieldArrivalSecondsV1(a,point))),
   useful:clamp(1-distance(input.self.position,point)/Math.max(1,input.self.topSpeedMps))};});
 for(const w of input.windows){
  if(w.family!=='direct'&&(!direct||w.eta<direct.eta+.08||distance(w.point,direct.point)<.5)){
   rejections.push({family:w.family,reason:'捕球時刻・場所が先行候補と重なる'});continue;
  }
  if(w.family!=='direct'&&w.arrivalSeconds>w.eta+.2){rejections.push({family:w.family,reason:'次の捕球窓にも間に合う見込みがない'});continue;}
  // A received claim says a peer intends to try, never that they will secure.
  const uncertainty=earliest?Math.max(.2,1-clamp(((direct?.eta??w.eta)-earliest.eta)/.6)*.8*clamp(earliest.claim.trust)):.65,
   distinct=direct?clamp((w.eta-direct.eta)/.8)*clamp(distance(w.point,direct.point)/2):0,
   additionalValue=w.family==='direct'?0:uncertainty*(w.family==='following'?.55+distinct*.65:.35+distinct*.4);
  let uncoveredLoss=0;
  for(const {threat,ownEta,peerEta,useful}of coverRisks){
   if(ownEta<threat.arrivalSeconds&&ownEta+.15<peerEta)
    uncoveredLoss=Math.max(uncoveredLoss,.8*useful*clamp((w.eta-ownEta)/Math.max(.1,threat.arrivalSeconds)));
  }
  options.push({...w,taskId:w.family==='direct'?'pickup':'pickup:'+w.family,additionalValue,uncoveredLoss,uncertainty,
   competitionScale:w.family==='direct'?4*(1-.65*uncertainty):0,
   reason:w.family==='direct'?'observed_ball_opportunity':w.family==='following'?'味方とは異なる時刻・場所で次の捕球を狙う':'後逸・跳ね返りに備えた回収を選ぶ'});
 }
 return {options,rejections};
}
