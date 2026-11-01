/** Adapter for field's continuous collision solver. No rule or outcome is inferred. */
export type RunnerContactHitV1 = Readonly<{from:number;t:number;ambiguous?:boolean;[key:string]:unknown}>;
export type RunnerContactCandidateV1 = Readonly<{
  kind:'ball_runner'|'held_ball_runner'|'fielder_body_runner'|'fielder_glove_runner';
  id:string;runnerId:string;actorId?:string;from:number;at:number;ambiguous:boolean;hit:RunnerContactHitV1;
}>;
type Point = Readonly<{x:number;y:number;z:number}>;
type Collider = Readonly<{kind:RunnerContactCandidateV1['kind'];actorId?:string;at:(t:number)=>Point;radius:number;speedBound:number}>;
type Runner = Readonly<{runnerId:string;at:(t:number)=>Point;radius:number;speedBound:number}>;
export function collectRunnerContactCandidatesV1(input:Readonly<{
  from:number;through:number;rounding:number;runners:readonly Runner[];colliders:readonly Collider[];
  findContact:(gap:(t:number)=>number,speed:number,rounding:number,from:number,through:number)=>RunnerContactHitV1|null;
}>):RunnerContactCandidateV1[]{
 const out:RunnerContactCandidateV1[]=[];
 for(const runner of input.runners)for(const collider of input.colliders){
   const gap=(t:number)=>{const a=runner.at(t),b=collider.at(t);return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)-runner.radius-collider.radius;};
   const hit=input.findContact(gap,runner.speedBound+collider.speedBound,input.rounding,input.from,input.through);
   if(hit)out.push({id:[collider.kind,runner.runnerId,collider.actorId??'ball'].join(':'),kind:collider.kind,runnerId:runner.runnerId,...(collider.actorId===undefined?{}:{actorId:collider.actorId}),from:hit.from,at:hit.t,ambiguous:!!hit.ambiguous,hit});
 }
 return out;
}
