import type {Vec3} from '../../model/geometry';
import {observeBattedBallSpinV123} from '../../sim/contact/BattedBallSpinObservationV123';
export type SpinAimTechniqueV243='BACKSPIN'|'TOPSPIN'|'HOOK'|'SLICE';
type Candidate=Readonly<{ordinal:number;delta:Vec3;norm:number}>;
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),scale=(v:Vec3,k:number):Vec3=>({x:v.x*k||0,y:v.y*k||0,z:v.z*k||0}),cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const valid=(v:Vec3)=>!!v&&typeof v==='object'&&Object.keys(v).sort().join('|')==='x|y|z'&&[v.x,v.y,v.z].every(Number.isFinite);
/** Fixed diagnostic policy; target axis describes spin, never a guaranteed translation sign. */
export function createPredictedContactFrameCandidatesV243(input:Readonly<{normal:Vec3;normalExitVelocity:Vec3;bats:'R'|'L';technique:SpinAimTechniqueV243}>) {
 const none=(reason:string)=>({status:'NO_TARGET' as const,reason});
 if(!input||Object.keys(input).sort().join('|')!=='bats|normal|normalExitVelocity|technique'||!valid(input.normal)||!valid(input.normalExitVelocity)||!['R','L'].includes(input.bats)||!['BACKSPIN','TOPSPIN','HOOK','SLICE'].includes(input.technique))return none('INVALID_FRAME');
 const nlen=norm(input.normal);if(!(nlen>1e-12&&Number.isFinite(nlen)))return none('DEGENERATE_CONTACT_NORMAL');
 const observation=observeBattedBallSpinV123({velocityMps:input.normalExitVelocity,spinRadPerSecond:{x:0,y:0,z:0},bats:input.bats});
 if(observation.basisStatus!=='DEFINED')return none('UNDEFINED_FLIGHT_FRAME');
 const n=scale(input.normal,1/nlen),{right,up}=observation.basis,axis=input.technique==='BACKSPIN'?scale(right,-1):input.technique==='TOPSPIN'?scale(right,1):scale(up,(input.technique==='HOOK'?-1:1)*(input.bats==='R'?1:-1));
 const first=cross(n,axis),length=norm(first);if(!(length>1e-12&&Number.isFinite(length)))return none('DEGENERATE_TANGENT_BASIS');
 const t1=scale(first,1/length),t2=cross(n,t1),unitDiagonal=1/Math.sqrt(2),directions=[t1,scale(t1,-1),t2,scale(t2,-1),scale(add(t1,t2),unitDiagonal),scale(add(t1,scale(t2,-1)),unitDiagonal),scale(add(scale(t1,-1),t2),unitDiagonal),scale(add(scale(t1,-1),scale(t2,-1)),unitDiagonal)];
 const candidates:Candidate[]=[{ordinal:0,delta:{x:0,y:0,z:0},norm:0}];for(const radius of [.02/3,.04/3,.02])for(const direction of directions){const delta=scale(direction,radius);candidates.push({ordinal:candidates.length,delta,norm:norm(delta)});}
 return {status:'READY' as const,normal:n,targetSpinAxis:axis,t1,t2,candidates,policy:'FIXED_25_UNCALIBRATED_V243' as const};
}
/** Caller supplies only already-predicted candidate components. */
export function selectPredictedContactFrameCandidateV243<T extends Readonly<{ordinal:number;norm:number;component:number}>>(input:Readonly<{normalComponent:number;minimumComponent:number;minimumImprovement:number;candidates:readonly T[]}>):T|null {
 if(![input.normalComponent,input.minimumComponent,input.minimumImprovement].every(Number.isFinite)||input.minimumComponent<0||input.minimumImprovement<0)throw Error('invalid diagnostic thresholds');
 const eligible=input.candidates.filter(c=>Number.isSafeInteger(c.ordinal)&&c.ordinal>=0&&Number.isFinite(c.norm)&&c.norm>=0&&Number.isFinite(c.component)&&c.component>=input.minimumComponent&&c.component-input.normalComponent>=input.minimumImprovement);
 eligible.sort((a,b)=>b.component-a.component||a.norm-b.norm||a.ordinal-b.ordinal);return eligible[0]??null;
}
