/* Presentation only: a modest glance following an unswung actual pitch.
 * The last observed free-ball position remains a gaze target after possession;
 * it is never reintroduced as a visible ball or a physical observation. */
(function(root){
 'use strict';
 function observe({record,frame,sceneMs,preparationMs}){
  if(!record||!frame||sceneMs<preparationMs||frame.phase==='bench'||record.play?.diagnostics?.swingOffered!==false)return null;
  const tps=record.play.diagnostics.sourceClockTicksPerSecond,first=record.frames[0]?.tick;
  if(!Number.isFinite(tps)||tps<=0||!Number.isFinite(first))return null;
  let start=null,last=null;
  for(const sample of record.frames){
   if(sample.tick>frame.tick)break;
   if(sample.ballKind==='pitch'&&sample.ball&&sample.ball.visible!==false&&!sample.possessedBy){
    const p=sample.ball.position;
    if(!p||!['x','y','z'].every(axis=>Number.isFinite(p[axis])))continue;
    if(start===null&&p.z<=1)start=sample.tick;
    last=sample;
   }
  }
  if(start===null||!last)return null;
  const startAtMs=preparationMs+(start-first)/tps*1000,
   observedElapsedMs=Math.max(sceneMs-preparationMs,(frame.tick-first)/tps*1000),
   progress=Math.max(0,Math.min(1,(observedElapsedMs-(start-first)/tps*1000)/165));
  return {target:{...last.ball.position,z:Math.max(-.42,last.ball.position.z)},
   startTick:start,startAtMs,lastVisibleTick:last.tick,progress,smooth:progress*progress*(3-2*progress),
   basis:'ACTUAL_TAKEN_PITCH_PREFIX; LAST_VISIBLE_TARGET_AFTER_CATCH; 165MS_MODEST_GLANCE'};
 }
 root.KneekuraLiveTakenPitchGaze=Object.freeze({version:1,observe});
})(typeof globalThis==='object'?globalThis:this);
