import type {Vec3} from '../../model/geometry';
import {readLiveFieldCommitmentV1,liveFieldBodyEnvelopeRadiusV1,liveFieldCommitmentKeyV1,type LiveFieldCommitmentV1,type LiveBodyBezierSegmentV1} from './LiveFieldCommitmentV1';

export type LiveAthleticClearanceInputV1=Readonly<{scope:object;worldRevision:number;clock:Readonly<{originTick:number;ticksPerSecond:number}>;
 fromSeconds:number;throughSeconds:number;commands:readonly LiveFieldCommitmentV1[];expectedActorIds:readonly string[];
 /** A local motor-option check only. Omit for the final joint commit proof. */
 focusActorId?:string;
 fence?:Readonly<{center:Readonly<{x:number;z:number}>;radiusMeters:number}>}>;
export type LiveAthleticClearanceResultV1=Readonly<{kind:'safe'|'unsafe'|'unknown';reason:string;worldRevision:number;
 fromSeconds:number;throughSeconds:number;focusActorId:string|null;commandBindings:readonly string[];checkedIntervals:number;minimumCertifiedGapMeters:number|null}>;
const mix=(a:Vec3,b:Vec3,u:number):Vec3=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u}),
 norm=(p:Vec3)=>Math.hypot(p.x,p.y,p.z),sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
type Controls=readonly [Vec3,Vec3,Vec3,Vec3];
const split=(c:Controls,u:number):readonly [Controls,Controls]=>{const a=mix(c[0],c[1],u),b=mix(c[1],c[2],u),d=mix(c[2],c[3],u),e=mix(a,b,u),f=mix(b,d,u),g=mix(e,f,u);return[[c[0],a,e,g],[g,f,d,c[3]]];};
const clip=(s:LiveBodyBezierSegmentV1,from:number,through:number):Controls=>{
 const first=from===s.fromSeconds?s.controls:split(s.controls,(from-s.fromSeconds)/(s.throughSeconds-s.fromSeconds))[1];
 return through===s.throughSeconds?first:split(first,(through-from)/(s.throughSeconds-from))[0];
};
const boundsDistance=(c:Controls)=>Math.hypot(...(['x','y','z'] as const).map(axis=>{
 const lo=Math.min(...c.map(p=>p[axis])),hi=Math.max(...c.map(p=>p[axis]));return lo>0?lo:hi<0?-hi:0;
}));
const certificates=new WeakMap<object,Readonly<{key:string;scope:object;commands:readonly LiveFieldCommitmentV1[]}>>();
const binding=(q:LiveAthleticClearanceInputV1)=>JSON.stringify([q.worldRevision,[q.clock.originTick,q.clock.ticksPerSecond],q.fromSeconds,q.throughSeconds,q.focusActorId??null,q.expectedActorIds?.slice().sort(),q.fence?[q.fence.center.x,q.fence.center.z,q.fence.radiusMeters]:null]);

/** A continuous convex-hull proof over exact cubic command intervals. The
 * broad whole-body envelope may return unknown for a harmless close pass; it
 * never treats an envelope overlap alone as a real torso collision. No role,
 * catch or outcome is selected here, and no personality bypass is accepted. */
export function certifyLiveAthleticClearanceV1(q:LiveAthleticClearanceInputV1):LiveAthleticClearanceResultV1{
 if(!q.scope||typeof q.scope!=='object'||!Number.isSafeInteger(q.worldRevision)||q.worldRevision<0||!q.clock||!Number.isSafeInteger(q.clock.originTick)||q.clock.originTick<0
  ||!Number.isSafeInteger(q.clock.ticksPerSecond)||q.clock.ticksPerSecond<=0||!Number.isFinite(q.fromSeconds)||q.fromSeconds<0
  ||!Number.isFinite(q.throughSeconds)||q.throughSeconds<=q.fromSeconds||!Array.isArray(q.commands)||q.commands.length<1||q.commands.length>9)
  throw Error('invalid live athletic clearance scope');
 const commands=q.commands.map(readLiveFieldCommitmentV1);
 if(new Set(commands.map(c=>c.actorId)).size!==commands.length)throw Error('duplicate clearance actor');
 if(q.fence&&(![q.fence.center.x,q.fence.center.z,q.fence.radiusMeters].every(Number.isFinite)||q.fence.radiusMeters<=0))throw Error('invalid clearance fence');
 let checkedIntervals=0,minimum=Infinity;
 const finish=(kind:LiveAthleticClearanceResultV1['kind'],reason:string)=>{
  const result=Object.freeze({kind,reason,worldRevision:q.worldRevision,fromSeconds:q.fromSeconds,throughSeconds:q.throughSeconds,focusActorId:q.focusActorId??null,
   commandBindings:Object.freeze(commands.map(liveFieldCommitmentKeyV1).sort()),checkedIntervals,minimumCertifiedGapMeters:Number.isFinite(minimum)?minimum:null});
  if(kind==='safe')certificates.set(result,{key:binding(q),scope:q.scope,commands});return result;
 };
 if(!Array.isArray(q.expectedActorIds)||q.expectedActorIds.length!==commands.length||new Set(q.expectedActorIds).size!==q.expectedActorIds.length
  ||commands.some(c=>!q.expectedActorIds.includes(c.actorId)))return finish('unknown','current_body_snapshot_incomplete');
 if(q.focusActorId!==undefined&&!q.expectedActorIds.includes(q.focusActorId))return finish('unknown','focused_actor_missing');
 // An old airborne source is re-bound by its physical owner to this current
 // snapshot with the same immutable command ID/revision/curve. A received old
 // declaration alone is not a current-world command or a fresh certificate.
 if(commands.some(c=>c.worldRevision!==q.worldRevision))return finish('unknown','stale_world_command_binding');
 if(commands.some(c=>c.clock.originTick!==q.clock.originTick||c.clock.ticksPerSecond!==q.clock.ticksPerSecond||c.fromSeconds>q.fromSeconds||c.throughSeconds<q.throughSeconds))return finish('unknown','future_command_coverage_missing');
 const pair=(a:Controls,b:Controls,radius:number,torso:number,depth=0):'safe'|'unsafe'|'unknown'=>{
  checkedIntervals++;if(checkedIntervals>32768)return'unknown';
  const relative=a.map((p,i)=>sub(p,b[i])) as unknown as Controls,
   rounding=8192*Number.EPSILON*Math.max(1,...a.map(norm),...b.map(norm)),gap=boundsDistance(relative)-radius;
  if(gap>.02+rounding){minimum=Math.min(minimum,gap-rounding);return'safe';}
  const [left]=split(relative,.5);
  if([relative[0],left[3],relative[3]].some(p=>norm(p)+rounding<torso))return'unsafe';
  // A witnessed envelope overlap cannot become a whole-body clearance proof.
  // If this hull also proves the real torsos separate, stop that branch as
  // unknown; refining it exponentially cannot grant safe authority.
  if(boundsDistance(relative)>torso+rounding&&[relative[0],left[3],relative[3]].some(p=>norm(p)<=radius+.02-rounding))return'unknown';
  if(depth>=22)return'unknown';
  const [al,ar]=split(a,.5),[bl,br]=split(b,.5),first=pair(al,bl,radius,torso,depth+1);
  if(first==='unsafe')return first;const second=pair(ar,br,radius,torso,depth+1);
  return second==='unsafe'?'unsafe':first==='safe'&&second==='safe'?'safe':'unknown';
 };
 const fence=(c:Controls,radius:number,torso:number,depth=0):'safe'|'unsafe'|'unknown'=>{
  checkedIntervals++;if(checkedIntervals>32768)return'unknown';const f=q.fence!;
  const radial=(p:Vec3)=>Math.hypot(p.x-f.center.x,p.z-f.center.z),rounding=8192*Number.EPSILON*Math.max(1,...c.map(norm),f.radiusMeters);
  if(c.every(p=>radial(p)+radius+.02+rounding<=f.radiusMeters))return'safe';
  const [left,right]=split(c,.5);if([c[0],left[3],c[3]].some(p=>radial(p)+torso>f.radiusMeters+rounding))return'unsafe';
  if(c.every(p=>radial(p)+torso+rounding<=f.radiusMeters)&&[c[0],left[3],c[3]].some(p=>radial(p)+radius+.02>f.radiusMeters+rounding))return'unknown';
  if(depth>=22)return'unknown';const a=fence(left,radius,torso,depth+1),b=a==='unsafe'?'unsafe':fence(right,radius,torso,depth+1);
  return b==='unsafe'?'unsafe':a==='safe'&&b==='safe'?'safe':'unknown';
 };
 // A focused ordinary motor is checked only against committed athletic
 // bodies. Other ordinary/ordinary pairs stay with the existing motor guard;
 // their breakpoints cannot change this proof. All nine bindings/coverage
 // above remain mandatory and are revalidated at the commit boundary.
 const focus=q.focusActorId===undefined?undefined:commands.find(c=>c.actorId===q.focusActorId),
  relevant=focus?.kind==='motor'?commands.filter(c=>c===focus||c.kind==='athletic'):commands,
  cuts=[...new Set([q.fromSeconds,q.throughSeconds,...relevant.flatMap(c=>c.segments.flatMap(s=>[s.fromSeconds,s.throughSeconds])).filter(t=>t>q.fromSeconds&&t<q.throughSeconds)])].sort((a,b)=>a-b);
 let uncertain=false;
 for(let n=1;n<cuts.length;n++){
  const from=cuts[n-1],through=cuts[n],segments=relevant.map(c=>c.segments.find(s=>s.fromSeconds<=from&&s.throughSeconds>=through));
  if(segments.some(s=>!s))return finish('unknown','body_interval_missing');
  const curves=segments.map(s=>clip(s!,from,through));
  for(let i=0;i<relevant.length;i++){
   if(q.fence&&relevant[i].kind==='athletic'&&(q.focusActorId===undefined||q.focusActorId===relevant[i].actorId)){
    const r=fence(curves[i],liveFieldBodyEnvelopeRadiusV1(relevant[i]),relevant[i].bodyRadiusMeters);
    if(r==='unsafe')return finish('unsafe','body_crosses_fence');if(r==='unknown')uncertain=true;
   }
   for(let j=i+1;j<relevant.length;j++){
    if(relevant[i].kind!=='athletic'&&relevant[j].kind!=='athletic')continue;
    if(q.focusActorId!==undefined&&q.focusActorId!==relevant[i].actorId&&q.focusActorId!==relevant[j].actorId)continue;
    const r=pair(curves[i],curves[j],liveFieldBodyEnvelopeRadiusV1(relevant[i])+liveFieldBodyEnvelopeRadiusV1(relevant[j]),relevant[i].bodyRadiusMeters+relevant[j].bodyRadiusMeters);
    if(r==='unsafe')return finish('unsafe','swept_torso_contact');if(r==='unknown')uncertain=true;
   }
  }
 }
 return finish(uncertain?'unknown':'safe',uncertain?'whole_body_clearance_not_certified':'continuous_whole_body_clearance');
}

/** Must run again against current bindings at the synchronous commit boundary.
 * A copied token, changed peer, withdrawal or changed world is not authority. */
export function validateLiveAthleticClearanceV1(proof:LiveAthleticClearanceResultV1,current:LiveAthleticClearanceInputV1):boolean{
 try{const certificate=certificates.get(proof);
  if(proof.kind!=='safe'||certificate?.scope!==current.scope||certificate.key!==binding(current)||certificate.commands.length!==current.commands.length)return false;
  const commands=current.commands.map(readLiveFieldCommitmentV1);if(new Set(commands.map(c=>c.actorId)).size!==commands.length)return false;
  return certificate.commands.every(old=>{const now=commands.find(c=>c.actorId===old.actorId);return !!now&&(now===old||liveFieldCommitmentKeyV1(now)===liveFieldCommitmentKeyV1(old));});
 }catch{return false;}
}
