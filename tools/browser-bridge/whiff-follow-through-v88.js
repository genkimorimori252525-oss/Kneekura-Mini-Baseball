/* Observe the already registered finite motor after a secured whiff.
 * This module never extends a Source frame, ball flight, ruling or runner. */
(function(root){
 'use strict';
 function create({core}){
  const motors=new WeakMap();
  function observe({record,frame,sceneMs,preparationMs,measuredClip,bodyBatFrame}){
   const diagnostic=record?.play?.diagnostics,descriptor=diagnostic?.batPlaybackV88;
   if(record?.play?.call!=='swinging_strike'||!descriptor||diagnostic.swingOffered!==true||sceneMs<preparationMs)return null;
   if(frame.phase==='bench')return Object.freeze({bat:null,reason:'THIRD_OUT_BENCH_HAS_PRIORITY'});
   const tick=record.frames[0].tick+(sceneMs-preparationMs)/1000*diagnostic.sourceClockTicksPerSecond;
   if(tick<=record.frames.at(-1).tick)return null;
   let motor=motors.get(record);if(!motor){motor=core.createLiveBatPlaybackV88({descriptor,measuredClip});motors.set(record,motor);}
   if(tick>=motor.throughTick&&bodyBatFrame===0)return Object.freeze({bat:null,reason:'FINITE_FOLLOW_BODY_HOLD_COMPLETED',throughTick:motor.throughTick});
   // Clamp the last sample so a short measured tail is still visible when
   // the display interval crosses the end of the finite motion.
   const sampleTick=Math.min(tick,motor.throughTick),bat=motor.sampleAtTick(sampleTick);
   return Object.freeze({bat,sampleTick,throughTick:motor.throughTick,reason:sampleTick===motor.throughTick?'FINITE_MEASURED_END_POSE':'REGISTERED_MEASURED_FOLLOW_THROUGH'});
  }
  return Object.freeze({observe});
 }
 root.KneekuraWhiffFollowThroughV88=Object.freeze({version:88,create});
})(globalThis);
