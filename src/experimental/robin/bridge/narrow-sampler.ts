/** Experimental adapter for captured original PitchPath. No Core authority. */
type Vec = Readonly<{x:number;y:number;z:number}>;
type Path = Readonly<{dt:number;points:readonly Vec[];hiddenAfterT?:number}>;
type Segment = Readonly<{fromSeconds:number;throughSeconds:number;from:Vec;to:Vec;velocity:Vec;maximumPositionSpeedMps:number}>;
const interpolate=(a:Vec,b:Vec,u:number):Vec=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u});
export function createRobinPathSamplerV1(path:Path, originSeconds=0) {
  if(originSeconds!==0) throw Error('narrow Robin HOLD: origin');
  if(!Number.isFinite(path.dt)||path.dt<=0||path.points.length<2||!path.points.every(p=>[p.x,p.y,p.z].every(Number.isFinite))) throw Error('invalid original Robin path');
  if(path.dt<.004||path.dt>.005||path.points.length>256||path.dt*(path.points.length-1)>1||!path.points.every(p=>[p.x,p.y,p.z].every(v=>Math.abs(v)<=20)))throw Error('narrow Robin HOLD: domain');
  const points=path.points.map(p=>Object.freeze({...p})),dt=path.dt,hiddenAfterT=path.hiddenAfterT;
  const segments:readonly Segment[]=Object.freeze(points.slice(1).map((to,i)=>{const from=points[i],velocity=Object.freeze({x:(to.x-from.x)/dt,y:(to.y-from.y)/dt,z:(to.z-from.z)/dt});return Object.freeze({fromSeconds:originSeconds+i*dt,throughSeconds:originSeconds+(i+1)*dt,from,to,velocity,maximumPositionSpeedMps:Math.hypot(velocity.x,velocity.y,velocity.z)});}));
  const endSeconds=originSeconds+segments.length*dt;
  function originalPosition(seconds:number):Vec {
    const raw=seconds/dt,last=points.length-1;
    if(!(raw>0))return points[0];if(raw>=last)return points[last];
    const i=Math.floor(raw);return interpolate(points[i],points[i+1],raw-i);
  }
  function originalBackwardVelocity(seconds:number):Vec {
    const a=originalPosition(seconds-dt),b=originalPosition(seconds);
    return {x:(b.x-a.x)/dt,y:(b.y-a.y)/dt,z:(b.z-a.z)/dt};
  }
  function sample(seconds:number){
    if(!Number.isFinite(seconds)||seconds<originSeconds||seconds>endSeconds) throw Error('time outside original Robin path: '+seconds+' > '+endSeconds);
    // Multiples are recognized against the same i*dt clock used to build segments.
    const isFinal=seconds===endSeconds,nearest=isFinal?segments.length:Math.round((seconds-originSeconds)/dt),atNode=nearest>=0&&nearest<=segments.length&&seconds===originSeconds+nearest*dt;
    const left=atNode?(nearest>0?segments[nearest-1].velocity:null):segments[Math.floor((seconds-originSeconds)/dt)].velocity;
    const right=atNode?(nearest<segments.length?segments[nearest].velocity:null):left;
    const index=Math.max(0,Math.min(Math.floor((seconds-originSeconds)/dt),segments.length-1)),s=segments[index];
    const position=atNode?points[nearest]:interpolate(s.from,s.to,(seconds-s.fromSeconds)/dt);
    return {seconds,position,velocityIncoming:left,velocityOutgoing:right,visible:hiddenAfterT===undefined||seconds-originSeconds<hiddenAfterT,exists:true as const};
  }
  return Object.freeze({version:'robin_original_path_linear_v1' as const,segments,originSeconds,endSeconds,hiddenAfterT,sample,originalPosition,originalBackwardVelocity});
}




