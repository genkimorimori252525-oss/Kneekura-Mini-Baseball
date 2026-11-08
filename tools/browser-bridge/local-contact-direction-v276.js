/* Pure projection of recorded world-space exit velocities; no physics or identity authority. */
(function(root){
 'use strict';
 function project(report){
  if(!report||!Array.isArray(report.contacts))return {status:'UNKNOWN',reason:'CONTACTS_UNAVAILABLE',contacts:[]};
  const contacts=report.contacts.map(c=>{
   const v=c?.exitVelocity;
   if(!v||![v.x,v.y,v.z].every(Number.isFinite)||Math.hypot(v.x,v.z)===0)return {pitchOrdinal:c?.pitchOrdinal??null,status:'UNKNOWN',angleDegrees:null,side:null};
   return {pitchOrdinal:c.pitchOrdinal,status:'OBSERVED',angleDegrees:Math.atan2(v.x,v.z)*180/Math.PI,side:v.x>0?'FIRST_BASE_SIDE':v.x<0?'THIRD_BASE_SIDE':'CENTER_AXIS'};
  });
  const counts={firstBaseSide:0,thirdBaseSide:0,centerAxis:0,unknown:0};
  for(const c of contacts){if(c.status==='UNKNOWN')counts.unknown++;else if(c.side==='FIRST_BASE_SIDE')counts.firstBaseSide++;else if(c.side==='THIRD_BASE_SIDE')counts.thirdBaseSide++;else counts.centerAxis++;}
  return {status:counts.unknown?'PARTIAL':'OBSERVED',counts,contacts};
 }
 root.KneekuraContactDirectionProjectionV276=Object.freeze({project});
})(globalThis);
