/* Read-only gaze for the finite measured swing. Never follows the actual hit
 * location: the motor was registered to forecast position + authored aim error. */
(function(root){
 'use strict';
 function observe({record,frame,sceneMs,preparationMs}){
  const d=record?.play?.diagnostics;
  if(!record||!frame||frame.phase==='bench'||sceneMs<preparationMs||d?.swingOffered!==true)return null;
  const offense=record.beforeMatch?.half==='top'?0:1;
  if(record.command?.managedTeam===offense&&record.command?.batting==='bunt')return null;
  const tps=d.sourceClockTicksPerSecond,start=d.referenceStartTick,end=d.referenceThroughTick,
   release=record.frames[0]?.tick,forecast=d.zoneJudgment?.observedForecastPosition,error=d.aimErrorMeters;
  if(![tps,start,end,release,sceneMs,preparationMs].every(Number.isFinite)||tps<=0||end<=start)return null;
  if(!forecast||!error||!['x','y','z'].every(axis=>Number.isFinite(forecast[axis])&&Number.isFinite(error[axis])))return null;
  // Presentation can continue after a dead-ball Source frame stops advancing.
  // Use the same elapsed motor clock as the existing body animation, including
  // rewinds, without extending the measured motion by its static sprite hold.
  const startAtMs=preparationMs+(start-release)/tps*1000,
   releaseAtMs=preparationMs+(end-release)/tps*1000;
  // Compare absolute presentation times so subtracting preparation cannot
  // round the exact end back into the finite interval.
  if((sceneMs<startAtMs&&frame.tick<start)||sceneMs>=releaseAtMs||frame.tick>=end)return null;
  return {target:{x:forecast.x+error.x,y:forecast.y+error.y,z:forecast.z+error.z},
   startTick:start,throughTick:end,releaseAtMs,
   basis:'PLANNED_MEASURED_SWEET_SPOT_UNTIL_FINITE_SWING_END'};
 }
 root.KneekuraLiveBatterGaze=Object.freeze({version:1,observe});
})(typeof globalThis==='object'?globalThis:this);
