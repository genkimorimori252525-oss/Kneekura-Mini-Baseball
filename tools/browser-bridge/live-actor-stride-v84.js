/* Reuse the two existing run silhouettes. Distances come only from admitted
 * canonical actor positions; this is a display convention, not a gait model. */
(function(root){
 'use strict';
 const legacy=root.KneekuraLiveActorAnimation;
 if(!legacy?.observe)throw Error('V84 actor stride requires the existing actor observer');
 let enabled=true;
 const metersPerPose=1.4,point=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 let cachedRecord=null,cachedEntry=null;
 function at(record,tick){
  // Keep only the current replay's prefix, rather than attaching a distance
  // history to every retained pitch in a full match. Re-seeking is deterministic.
  if(cachedRecord!==record){cachedRecord=record;cachedEntry={through:-1,positions:new Map(),distances:new Map(),rows:[]};}
  const entry=cachedEntry;
  for(let i=entry.through+1;i<record.frames.length&&record.frames[i].tick<=tick;i++){
   const frame=record.frames[i];
   for(const actor of frame.actors){
    if(!point(actor.position))continue;
    const previous=entry.positions.get(actor.playerId),p=actor.position;
    const d=previous?Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z):0;
    entry.distances.set(actor.playerId,(entry.distances.get(actor.playerId)??0)+d);
    entry.positions.set(actor.playerId,{x:p.x,y:p.y,z:p.z});
   }
   entry.rows.push({tick:frame.tick,distances:new Map(entry.distances)});entry.through=i;
  }
  let lo=0,hi=entry.rows.length;
  while(lo<hi){const middle=Math.floor((lo+hi)/2);if(entry.rows[middle].tick<=tick)lo=middle+1;else hi=middle;}
  return entry.rows[lo-1]?.distances??new Map();
 }
 function observe(input){
  const result=legacy.observe(input);
  if(!enabled||!input.record?.frames?.length||!Object.values(result.actors).some(a=>a.action==='run'))return result;
  const distances=at(input.record,input.frame.tick),actors={...result.actors};
  for(const actor of input.frame.actors){
   const pose=actors[actor.playerId];if(pose?.action!=='run')continue;
   const distance=distances.get(actor.playerId)??0;
   actors[actor.playerId]={...pose,frame:Math.floor(distance/metersPerPose)%2,strideDistanceMeters:distance};
  }
  return {...result,actors};
 }
 root.KneekuraLiveActorAnimation=Object.freeze({...legacy,version:84,observe});
 root.KneekuraActorStrideV84=Object.freeze({version:84,configure(input={}){
  if(Object.keys(input).some(k=>k!=='enabled')||typeof input.enabled!=='boolean')throw Error('V84 actor stride requires boolean enabled');
  enabled=input.enabled;return this.inspect();
 },inspect:()=>Object.freeze({enabled,metersPerPose,poses:2,empiricallyCalibrated:false,authority:'READ_ONLY_PRESENTATION_CONVENTION'})});
})(globalThis);
